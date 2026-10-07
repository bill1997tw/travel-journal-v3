(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) {
    module.exports = api;
  }
  if (root) {
    root.VoyageItineraryTime = Object.freeze(api);
  }
})(typeof window !== "undefined" ? window : globalThis, function () {
  "use strict";

  const TIME_TYPES = new Set(["fixed", "estimated", "unset"]);

  function parseTimeRange(value) {
    const matches = String(value || "").match(/\b(?:[01]\d|2[0-3]):[0-5]\d\b/g) || [];
    return {
      start: matches[0] || "",
      end: matches[1] || ""
    };
  }

  function timeToMinutes(value) {
    const match = String(value || "").match(/^(\d{2}):(\d{2})$/);
    if (!match) return null;
    return Number(match[1]) * 60 + Number(match[2]);
  }

  function inferTimeType(item) {
    const explicit = String(item?.timeType || "").trim();
    if (TIME_TYPES.has(explicit)) return explicit;
    return parseTimeRange(item?.time).start ? "estimated" : "unset";
  }

  function normalizeTimeType(value, timeValue = "") {
    const normalized = String(value || "").trim();
    if (TIME_TYPES.has(normalized)) return normalized;
    return parseTimeRange(timeValue).start ? "estimated" : "unset";
  }

  function buildTimeValue(start, end) {
    const normalizedStart = String(start || "").trim();
    const normalizedEnd = String(end || "").trim();
    if (!normalizedStart) return "";
    if (normalizedEnd && normalizedEnd <= normalizedStart) return null;
    return normalizedEnd ? `${normalizedStart} - ${normalizedEnd}` : normalizedStart;
  }

  function detectConflicts(items) {
    const conflicts = [];
    let previous = null;
    (Array.isArray(items) ? items : []).forEach((item, index) => {
      const range = parseTimeRange(item?.time);
      const startMinutes = timeToMinutes(range.start);
      if (startMinutes === null) return;
      if (previous && startMinutes < previous.startMinutes) {
        conflicts.push({
          previousId: String(previous.item?.id || ""),
          currentId: String(item?.id || ""),
          previousIndex: previous.index,
          currentIndex: index
        });
      }
      previous = { item, index, startMinutes };
    });
    return conflicts;
  }

  function sortItemsChronologically(items) {
    return (Array.isArray(items) ? items : [])
      .map((item, index) => {
        const start = parseTimeRange(item?.time).start;
        return { item, index, minutes: timeToMinutes(start) };
      })
      .sort((left, right) => {
        if (left.minutes === null && right.minutes === null) return left.index - right.index;
        if (left.minutes === null) return 1;
        if (right.minutes === null) return -1;
        return left.minutes - right.minutes || left.index - right.index;
      })
      .map(entry => entry.item);
  }

  function getTimeTypeLabel(type) {
    return ({ fixed: "固定", estimated: "預估", unset: "未設定" })[type] || "預估";
  }

  return {
    parseTimeRange,
    timeToMinutes,
    inferTimeType,
    normalizeTimeType,
    buildTimeValue,
    detectConflicts,
    sortItemsChronologically,
    getTimeTypeLabel
  };
});
