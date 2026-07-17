(() => {
  "use strict";

  const script = document.currentScript;
  if (!script?.src) {
    console.warn("[Atendimento Central] Não foi possível localizar o script.");
    return;
  }

  const panelOrigin = new URL(script.src).origin;
  const siteId = String(script.dataset.site || "")
    .trim()
    .toLowerCase();

  if (!/^[a-z0-9_-]{2,40}$/.test(siteId)) {
    console.warn("[Atendimento Central] Identificador do site ausente ou inválido.");
    return;
  }

  const customSelector = String(script.dataset.selector || "").trim();
  const selector = customSelector || [
    'a[href*="wa.me"]',
    'a[href*="wa.link"]',
    'a[href*="whatsapp.com"]',
    'a[href*="t.me/"]',
    'a[href*="telegram.me/"]',
    `a[href*="${panelOrigin}/zap/"]`,
    "a.link-whatsapp",
    "a.link-telegram",
    "a.link-contato",
    "a[data-whatsapp]",
    "a[data-telegram]",
    "a[data-contact]"
  ].join(",");

  function isSupportedLink(element) {
    return (
      element instanceof HTMLAnchorElement &&
      (element.dataset.contactConnected === "redirect" ||
        element.dataset.whatsappConnected === "redirect" ||
        element.matches(selector))
    );
  }

  function buildRedirectUrl(link) {
    const redirectUrl = new URL(
      `/zap/${encodeURIComponent(siteId)}`,
      panelOrigin
    );

    if (window.location.hostname) {
      redirectUrl.searchParams.set("source", window.location.hostname);
    }

    const customMessage = String(
      link.dataset.contactMessage ||
      link.dataset.whatsappMessage ||
      link.dataset.telegramMessage ||
      ""
    ).trim();

    if (customMessage) {
      redirectUrl.searchParams.set("text", customMessage.slice(0, 500));
    }

    return redirectUrl.href;
  }

  function connectLink(link) {
    if (!isSupportedLink(link)) return;

    const redirectUrl = buildRedirectUrl(link);

    if (!link.dataset.contactOriginalHref) {
      link.dataset.contactOriginalHref = link.getAttribute("href") || "";
    }

    if (link.href !== redirectUrl) {
      link.href = redirectUrl;
    }

    link.dataset.contactConnected = "redirect";
    link.dataset.whatsappConnected = "redirect";
    link.setAttribute(
      "aria-label",
      link.getAttribute("aria-label") || "Abrir atendimento"
    );
  }

  function connectAll(root = document) {
    if (root instanceof HTMLAnchorElement) {
      connectLink(root);
    }

    if (root.querySelectorAll) {
      root.querySelectorAll(selector).forEach(connectLink);
    }
  }

  connectAll();

  document.addEventListener(
    "pointerdown",
    (event) => {
      const link = event.target?.closest?.("a");
      if (link) connectLink(link);
    },
    true
  );

  document.addEventListener(
    "click",
    (event) => {
      const link = event.target?.closest?.("a");
      if (link) connectLink(link);
    },
    true
  );

  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      if (mutation.type === "childList") {
        mutation.addedNodes.forEach((node) => {
          if (node.nodeType === Node.ELEMENT_NODE) {
            connectAll(node);
          }
        });
      }

      if (
        mutation.type === "attributes" &&
        mutation.target instanceof HTMLAnchorElement
      ) {
        connectLink(mutation.target);
      }
    }
  });

  const startObserver = () => {
    if (!document.documentElement) return;
    observer.observe(document.documentElement, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: [
        "href",
        "data-contact-message",
        "data-whatsapp-message",
        "data-telegram-message"
      ]
    });
  };

  if (document.readyState === "loading") {
    document.addEventListener(
      "DOMContentLoaded",
      () => {
        connectAll();
        startObserver();
      },
      { once: true }
    );
  } else {
    startObserver();
  }
})();
