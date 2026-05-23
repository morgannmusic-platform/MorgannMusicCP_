(function () {
  const mount = document.getElementById("footer-container");
  if (!mount) return;

  fetch("/podcast/footer.html", { cache: "no-store" })
    .then((res) => {
      if (!res.ok) throw new Error("Footer fetch failed");
      return res.text();
    })
    .then((html) => {
      mount.innerHTML = html;
    })
    .catch(() => {
      mount.innerHTML = '<footer class="footer"><div class="footer-container"><div class="footer-bottom"><p>© 2026 Morgann Music CP</p></div></div></footer>';
    });
})();
