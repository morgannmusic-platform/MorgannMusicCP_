function applyThemeImages() {
    const isDark = window.matchMedia("(prefers-color-scheme: dark)").matches;

    document.querySelectorAll("[data-theme-img]").forEach(img => {
        img.src = isDark ? img.dataset.dark : img.dataset.light;
    });
}
console.log(
  "Mode sombre système =",
  window.matchMedia("(prefers-color-scheme: dark)").matches
);
