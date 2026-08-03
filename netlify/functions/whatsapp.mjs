import {
  readConfig,
  resolveSiteChannel,
  resolveSiteWebsiteUrl
} from "./lib/config-store.mjs";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Content-Type": "application/json; charset=utf-8",
  "Cache-Control": "no-store, max-age=0",
  "X-Content-Type-Options": "nosniff"
};

function json(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: CORS_HEADERS });
}

export default async (request) => {
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }
  if (request.method !== "GET") {
    return json({ error: "Método não permitido." }, 405);
  }

  const siteId =
    new URL(request.url).searchParams.get("site")?.toLowerCase().trim() || "";
  const config = await readConfig();
  const site = config.sites.find((item) => item.id === siteId);
  const channel = resolveSiteChannel(config, site);

  const websiteUrl =
    channel === "website" ? resolveSiteWebsiteUrl(config, site) : "";

  if (channel === "website" && !websiteUrl) {
    return json({ error: "O endereço personalizado ainda não foi configurado." }, 503);
  }

  if (channel === "telegram" && !config.telegramUsername) {
    return json({ error: "O Telegram ainda não foi configurado." }, 503);
  }

  if (channel === "whatsapp" && !config.number) {
    return json({ error: "O número do WhatsApp ainda não foi configurado." }, 503);
  }

  return json({
    channel,
    number: channel === "whatsapp" ? config.number : null,
    telegramUsername:
      channel === "telegram" ? config.telegramUsername : null,
    websiteUrl: channel === "website" ? websiteUrl : null,
    message: site?.message || config.defaultMessage,
    site: site
      ? { id: site.id, name: site.name, channel: site.channel || "default" }
      : null,
    updatedAt: config.updatedAt
  });
};

export const config = {
  path: "/api/whatsapp"
};
