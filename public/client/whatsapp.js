(() => {
  "use strict";

  const script = document.currentScript;
  if (!script?.src) return;

  const panelOrigin = new URL(script.src).origin;
  const siteId = (script.dataset.site || "").trim().toLowerCase();
  const customSelector = script.dataset.selector;
  const selector = customSelector || [
    'a[href*="wa.me"]',
    'a[href*="wa.link"]',
    'a[href*="whatsapp.com"]',
    "a.link-whatsapp",
    "a[data-whatsapp]"
  ].join(",");

  async function updateLinks() {
    try {
      const endpoint = new URL("/api/whatsapp", panelOrigin);
      if (siteId) endpoint.searchParams.set("site", siteId);

      const response = await fetch(endpoint, { cache: "no-store", mode: "cors" });
      if (!response.ok) throw new Error(`Configuração indisponível (${response.status})`);
      const config = await response.json();
      const number = String(config.number || "").replace(/\D/g, "");
      if (!/^\d{10,15}$/.test(number)) throw new Error("Número inválido");

      document.querySelectorAll(selector).forEach((link) => {
        const message = link.dataset.whatsappMessage || config.message || "";
        link.href = `https://wa.me/${number}?text=${encodeURIComponent(message)}`;
        link.target = "_blank";
        link.rel = "noopener noreferrer";
        link.dataset.whatsappConnected = "true";
      });
    } catch (error) {
      console.warn("[WhatsApp Central] Não foi possível atualizar os links. Os endereços originais serão mantidos.", error);
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", updateLinks, { once: true });
  } else {
    updateLinks();
  }
})();
