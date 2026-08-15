(function (global) {
  "use strict";

  const COLOR_COUNT = 6;

  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function colorIndex(tag) {
    return [...String(tag || "")]
      .reduce((total, character) => total + character.codePointAt(0), 0) % COLOR_COUNT;
  }

  function render(tags, { removable = false, removeAttribute = "data-favorite-tag-remove" } = {}) {
    return (Array.isArray(tags) ? tags : []).map(tag => {
      const safeTag = escapeHtml(tag);
      const removeButton = removable
        ? `<button type="button" ${removeAttribute}="${safeTag}" aria-label="移除標籤 ${safeTag}">×</button>`
        : "";
      return `<span class="favorite-tag favorite-tag-color-${colorIndex(tag)}">${safeTag}${removeButton}</span>`;
    }).join("");
  }

  global.VoyageTagChips = Object.freeze({ colorIndex, render });
})(typeof window === "undefined" ? globalThis : window);
