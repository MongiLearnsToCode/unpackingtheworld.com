/* Applied before first paint so a light-theme user never sees a dark flash. */
try {
  var stored = localStorage.getItem("utw-theme");
  if (stored === "light" || stored === "dark") document.documentElement.dataset.theme = stored;
} catch (e) {
  /* private mode / storage disabled: keep the default theme */
}
