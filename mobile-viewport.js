(function (global) {
  "use strict";

  const documentRef = global.document;
  const visualViewport = global.visualViewport;
  if (!documentRef || !visualViewport) return;

  const MOBILE_QUERY = "(max-width: 768px)";
  const KEYBOARD_RATIO = 0.78;
  const RESTORE_DELAYS = [80, 240, 480];
  const REVEAL_DELAYS = [0, 80, 180, 320];
  let focusedControl = null;
  let keyboardWasOpen = false;
  let savedWindowScroll = { left: 0, top: 0 };
  let savedScrollContainer = null;
  let savedContainerScrollTop = 0;
  let lockedWindowScrollTop = 0;
  let savedBodyStyles = null;

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

  function keepFocusedControlVisible() {
    if (!focusedControl?.isConnected || !keyboardLooksOpen()) return;

    const scrollContainer = focusedControl.closest?.(
      ".modal-content, .account-cloud-modal, .app-entry, [data-mobile-scroll-container]"
    );
    const viewportTop = Math.max(0, visualViewport.offsetTop || 0) + 16;
    const viewportBottom = viewportTop + visualViewport.height - 40;
    const controlRect = focusedControl.getBoundingClientRect();

    if (controlRect.top < viewportTop || controlRect.bottom > viewportBottom) {
      focusedControl.scrollIntoView?.({ block: "center", inline: "nearest", behavior: "auto" });
    }

    if (!scrollContainer) return;
    const refreshedRect = focusedControl.getBoundingClientRect();
    const desiredTop = viewportTop + Math.max(12, (viewportBottom - viewportTop - refreshedRect.height) / 2);
    const adjustment = refreshedRect.top - desiredTop;
    if (Math.abs(adjustment) > 8) {
      scrollContainer.scrollTop += adjustment;
    }
  }

  function scheduleFocusedControlReveal() {
    for (const delay of REVEAL_DELAYS) {
      global.setTimeout(() => {
        if (!focusedControl || !isEditableControl(documentRef.activeElement)) return;
        keepFocusedControlVisible();
      }, delay);
    }
  }

  function getOpenDialogState() {
    const modalOpen = Array.from(documentRef.querySelectorAll(".modal-overlay")).some((overlay) => {
      if (overlay.classList.contains("active")) return true;
      return global.getComputedStyle?.(overlay).display !== "none";
    });
    const accountOpen = Boolean(documentRef.querySelector(".account-cloud-overlay.is-open"));
    const inlineEditorOpen = Boolean(documentRef.querySelector(".inline-time-editor:not([hidden])"));
    return { anyOpen: modalOpen || accountOpen || inlineEditorOpen, inlineEditorOpen };
  }

  function lockBackgroundScroll() {
    if (savedBodyStyles || !documentRef.body) return;
    lockedWindowScrollTop = global.scrollY || global.pageYOffset || 0;
    savedBodyStyles = {
      position: documentRef.body.style.position,
      top: documentRef.body.style.top,
      left: documentRef.body.style.left,
      right: documentRef.body.style.right,
      width: documentRef.body.style.width,
      overflow: documentRef.body.style.overflow
    };
    documentRef.body.style.position = "fixed";
    documentRef.body.style.top = `-${lockedWindowScrollTop}px`;
    documentRef.body.style.left = "0";
    documentRef.body.style.right = "0";
    documentRef.body.style.width = "100%";
    documentRef.body.style.overflow = "hidden";
  }

  function unlockBackgroundScroll() {
    if (!savedBodyStyles || !documentRef.body) return;
    const previousStyles = savedBodyStyles;
    savedBodyStyles = null;
    Object.assign(documentRef.body.style, previousStyles);
    global.scrollTo?.({ left: 0, top: lockedWindowScrollTop, behavior: "auto" });
  }

  function syncOpenDialogExperience() {
    const { anyOpen, inlineEditorOpen } = getOpenDialogState();
    documentRef.body?.classList.toggle("voyage-inline-editor-open", inlineEditorOpen);
    if (!isMobileLayout()) {
      documentRef.body?.classList.remove("voyage-modal-scroll-locked");
      unlockBackgroundScroll();
      return;
    }
    documentRef.body?.classList.toggle("voyage-modal-scroll-locked", anyOpen);
    if (anyOpen) lockBackgroundScroll();
    else unlockBackgroundScroll();
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
    scheduleFocusedControlReveal();
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
    if (keyboardOpen) scheduleFocusedControlReveal();
    if (!keyboardOpen && keyboardWasOpen && !focusedControl) {
      keyboardWasOpen = false;
      scheduleViewportRestore();
    }
  });

  visualViewport.addEventListener("scroll", () => {
    updateViewportMetrics();
    if (focusedControl && keyboardLooksOpen()) scheduleFocusedControlReveal();
  }, { passive: true });
  const dialogObserver = new MutationObserver(syncOpenDialogExperience);
  dialogObserver.observe(documentRef.body, {
    subtree: true,
    childList: true,
    attributes: true,
    attributeFilter: ["class", "style", "hidden", "aria-hidden"]
  });
  global.addEventListener?.("resize", syncOpenDialogExperience, { passive: true });
  global.addEventListener?.("orientationchange", scheduleViewportRestore);
  updateViewportMetrics();
  syncOpenDialogExperience();

  global.VoyageMobileViewport = Object.freeze({
    restoreAfterKeyboard: scheduleViewportRestore,
    revealFocusedControl: scheduleFocusedControlReveal,
    syncOpenDialogs: syncOpenDialogExperience,
    updateViewportMetrics
  });
})(typeof window === "undefined" ? globalThis : window);
