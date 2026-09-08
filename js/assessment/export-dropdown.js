/* AI-CLO PTITHCM V12.6.36 — Assessment export dropdown interaction owner. */
(() => {
  "use strict";

  const SELECTOR = ".assessment-export-dropdown";

  function closeMenu(details) {
    if (details?.open) details.removeAttribute("open");
  }

  document.addEventListener("click", (event) => {
    const target = event.target;
    const inside = target?.closest?.(SELECTOR) || null;

    document.querySelectorAll(`${SELECTOR}[open]`).forEach((details) => {
      if (details !== inside) closeMenu(details);
    });

    const exportButton = target?.closest?.("[data-v1234-export]");
    if (exportButton) closeMenu(exportButton.closest(SELECTOR));
  });

  document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") return;
    const open = document.querySelector(`${SELECTOR}[open]`);
    if (!open) return;
    closeMenu(open);
    open.querySelector("summary")?.focus?.({ preventScroll: true });
  });
})();
