import { readConfig } from "./lib/config-store.mjs";
import { recordClick } from "./lib/click-store.mjs";

const ERROR_HEADERS = {
  "Content-Type": "text/html; charset=utf-8",
  "Cache-Control": "no-store, max-age=0",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "no-referrer",
  "X-Robots-Tag": "noindex, nofollow"
};

function errorPage(title, message, status = 500) {
  const safeTitle = String(title).replace(/[<>&"']/g, "");
  const safeMessage = String(message).replace(/[<>&"']/g, "");

  return new Response(
    `<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${safeTitle}</title>
  <style>
    body{margin:0;min-height:100vh;display:grid;place-items:center;background:#080b12;color:#fff;font-family:system-ui,sans-serif;padding:24px}
    main{max-width:560px;background:#111722;border:1px solid #263142;border-radius:22px;padding:32px;box-shadow:0 24px 70px #0008}
    h1{margin-top:0;font-size:28px}
    p{color:#b7c0cf;line-height:1.6}
    button{border:0;border-radius:12px;padding:13px 18px;font-weight:800;cursor:pointer}
  </style>
</head>
<body>
  <main>
    <h1>${safeTitle}</h1>
    <p>${safeMessage}</p>
    <button onclick="history.back()">Voltar ao site</button>
  </main>
</body>
</html>`,
    {
      status,
      headers: ERROR_HEADERS
    }
  );
}

function normalizedSiteId(value) {
  return String(value || "")
    .trim()
    .toLowerCase();
}

export default async (request, context) => {
  if (request.method !== "GET" && request.method !== "HEAD") {
    return errorPage(
      "Método não permitido",
      "Este endereço deve ser aberto por um botão de atendimento.",
      405
    );
  }

  const url = new URL(request.url);
  const siteId = normalizedSiteId(
    context?.params?.site ||
    url.searchParams.get("site")
  );

  if (!/^[a-z0-9_-]{2,40}$/.test(siteId)) {
    return errorPage(
      "Identificador inválido",
      "O botão de atendimento deste site não possui um identificador válido.",
      400
    );
  }

  let config;

  try {
    config = await readConfig();
  } catch (error) {
    console.error("[WhatsApp Redirect] Falha ao ler a configuração.", error);
    return errorPage(
      "Atendimento temporariamente indisponível",
      "Não foi possível consultar o número neste momento. Tente novamente em alguns segundos.",
      503
    );
  }

  const number = String(config.number || "").replace(/\D/g, "");
  if (!/^\d{10,15}$/.test(number)) {
    return errorPage(
      "WhatsApp não configurado",
      "O responsável pelo site ainda não configurou um número válido.",
      503
    );
  }

  const site = (config.sites || []).find(
    (item) => item.id === siteId
  );

  const customMessage = String(
    url.searchParams.get("text") || ""
  )
    .trim()
    .slice(0, 500);

  const message =
    customMessage ||
    site?.message ||
    config.defaultMessage ||
    "Olá! Vim pelo site e gostaria de mais informações.";

  const destination = new URL(`https://wa.me/${number}`);
  destination.searchParams.set("text", message);

  const isTest = url.searchParams.get("test") === "1";

  if (!isTest && request.method === "GET") {
    const clickTask = recordClick({
      request,
      siteId,
      siteName: site?.name || siteId,
      requestedSource: url.searchParams.get("source")
    }).catch((error) => {
      // Uma falha na estatística nunca deve impedir o atendimento.
      console.error("[WhatsApp Redirect] Falha ao registrar clique.", error);
    });

    if (typeof context?.waitUntil === "function") {
      context.waitUntil(clickTask);
    } else {
      void clickTask;
    }
  }

  return new Response(null, {
    status: 302,
    headers: {
      Location: destination.href,
      "Cache-Control": "no-store, max-age=0",
      Pragma: "no-cache",
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "no-referrer",
      "X-Robots-Tag": "noindex, nofollow"
    }
  });
};

export const config = {
  path: "/zap/:site"
};
