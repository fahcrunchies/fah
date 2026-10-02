/* Shared boilerplate for contact.html and the policy pages:
   fills any [data-cfg] element from FAHStore, sets the footer year,
   and wires the mobile menu toggle if one is present on the page. */
document.addEventListener("DOMContentLoaded", () => {
  if (window.FAHStore) {
    const cfg = FAHStore.getConfig();
    document.querySelectorAll("[data-cfg]").forEach(el => {
      const v = cfg[el.dataset.cfg];
      if (v === undefined) return;
      if (el.tagName === "A" && !el.textContent.trim()) el.textContent = v;
      else if (el.tagName !== "A") el.textContent = v;
    });
  }
  const yearEl = document.getElementById("year");
  if (yearEl) yearEl.textContent = new Date().getFullYear();

  const menuBtn = document.querySelector(".menu-btn");
  const menu = document.getElementById("menu");
  if (menuBtn && menu) {
    menuBtn.onclick = () => menuBtn.setAttribute("aria-expanded", menu.classList.toggle("open"));
    menu.onclick = e => { if (e.target.tagName === "A") { menu.classList.remove("open"); menuBtn.setAttribute("aria-expanded", "false"); } };
  }
});
