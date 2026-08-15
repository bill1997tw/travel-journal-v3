(function (global) {
  "use strict";

  const documentRef = global.document;
  const visualViewport = global.visualViewport;
  if (!documentRef || !visualViewport) return;

  const MOBILE_QUERY = "(max-width: 768px)";
  const KEYBOARD_RATIO = 0.78;
  const RESTORE_DELAYS = [80, 240, 480];
  let focusedControl = null;
  let keyboardWasOpen = false;
  let savedWindowScroll = { left: 0, top: 0 };
  let savedScrollContainer = null;
  let savedContainerScrollTop = 0;

  function isMobileLayout() {
    return !global.matchMedia || global.matchMedia(MOBILE_QUERY).matches;
  }

  function isEditableControl(target) {
    if (!target?.matches) return false;
    return target.matches(
      'input:not([type="checkbox"]):not([type="radio"]):not([type="range"]):not([type="file"]), textarea, select, [contenteditable="true"]'
    );
  }

  function updateViewportMetrics() {
    documentRef.documentElement.style.setProperty(
      "--voyage-visual-viewport-height",
      `${Math.round(visualViewport.height)}px`
    );
    documentRef.documentElement.style.setProperty(
      "--voyage-visual-viewport-offset-top",
      `${Math.round(visualViewport.offsetTop || 0)}px`
    );
  }

  function keyboardLooksOpen() {
    return visualViewport.height < global.innerHeight * KEYBOARD_RATIO;
  }

  function rememberScrollPosition(target) {
    savedWindowScroll = {
      left: global.scrollX || global.pageXOffset || 0,
      top: global.scrollY || global.pageYOffset || 0
    };
    savedScrollContainer = target?.closest?.(
      ".modal-content, .account-cloud-modal, .app-entry, [data-mobile-scroll-container]"
    ) || null;
    savedContainerScrollTop = savedScrollContainer?.scrollTop || 0;
  }

  function restoreScrollPosition() {
    if (isEditableControl(documentRef.activeElement)) return;
    updateViewportMetrics();
    if (savedScrollContainer?.isConnected) {
      savedScrollContainer.scrollTop = savedContainerScrollTop;
    }
    global.scrollTo?.({
      left: savedWindowScroll.left,
      top: savedWindowScroll.top,
      behavior: "auto"
    });
    documentRef.body?.classList.remove("voyage-mobile-keyboard-open");
  }

  function scheduleViewportRestore() {
    for (const delay of RESTORE_DELAYS) {
      global.setTimeout(() => {
        if (isEditableControl(documentRef.activeElement)) return;
        if (keyboardLooksOpen() && delay !== RESTORE_DELAYS.at(-1)) return;
        restoreScrollPosition();
      }, delay);
    }
  }

  documentRef.addEventListener("focusin", (event) => {
    if (!isMobileLayout() || !isEditableControl(event.target)) return;
    focusedControl = event.target;
    rememberScrollPosition(event.target);
    updateViewportMetrics();
  });

  documentRef.addEventListener("focusout", (event) => {
    if (event.target !== focusedControl) return;
    focusedControl = null;
    scheduleViewportRestore();
  });

  visualViewport.addEventListener("resize", () => {
    updateViewportMetrics();
    const keyboardOpen = Boolean(focusedControl) && keyboardLooksOpen();
    if (keyboardOpen) keyboardWasOpen = true;
    documentRef.body?.classList.toggle("voyage-mobile-keyboard-open", keyboardOpen);
    if (!keyboardOpen && keyboardWasOpen && !focusedControl) {
      keyboardWasOpen = false;
      scheduleViewportRestore();
    }
  });

  visualViewport.addEventListener("scroll", updateViewportMetrics, { passive: true });
  global.addEventListener?.("orientationchange", scheduleViewportRestore);
  updateViewportMetrics();

  global.VoyageMobileViewport = Object.freeze({
    restoreAfterKeyboard: scheduleViewportRestore,
    updateViewportMetrics
  });
})(typeof window === "undefined" ? globalThis : window);
