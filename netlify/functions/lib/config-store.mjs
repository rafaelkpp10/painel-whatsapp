import { getStore } from "@netlify/blobs";

const STORE_NAME = "whatsapp-central";
const CONFIG_KEY = "settings";

const CHANNELS = new Set(["whatsapp", "telegram", "website"]);
const SITE_CHANNELS = new Set(["default", "whatsapp", "telegram", "website"]);

export const DEFAULT_CONFIG = Object.freeze({
  defaultChannel: "whatsapp",
  number: "",
  telegramUsername: "",
  websiteUrl: "",
  defaultMessage: "Olá! Vim pelo site e gostaria de mais informações.",
  sites: [
    {
      id: "playsim",
      name: "PlaySim",
      channel: "default",
      websiteUrl: "",
      message: "Olá! Vim pelo site PlaySim e gostaria de conhecer os planos disponíveis."
    }
  ],
  updatedAt: null,
  updatedBy: null
});

function store() {
  return getStore({ name: STORE_NAME, consistency: "strong" });
}

function normalizeChannel(value, fallback = "whatsapp") {
  const normalized = String(value || "").trim().toLowerCase();
  return CHANNELS.has(normalized) ? normalized : fallback;
}

function normalizeSiteChannel(value) {
  const normalized = String(value || "").trim().toLowerCase();
  return SITE_CHANNELS.has(normalized) ? normalized : "default";
}

export function normalizeTelegramUsername(value) {
  let normalized = String(value || "").trim();
  if (!normalized) return "";

  try {
    if (/^https?:\/\//i.test(normalized)) {
      const url = new URL(normalized);
      if (!["t.me", "www.t.me", "telegram.me", "www.telegram.me"].includes(url.hostname.toLowerCase())) {
        return "";
      }
      normalized = url.pathname.split("/").filter(Boolean)[0] || "";
    }
  } catch {
    return "";
  }

  normalized = normalized
    .replace(/^@+/, "")
    .split(/[/?#]/)[0]
    .trim();

  return /^[a-zA-Z0-9_]{5,32}$/.test(normalized)
    ? normalized
    : "";
}


export function normalizeWebsiteUrl(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";

  try {
    const url = new URL(raw);
    if (!["http:", "https:"].includes(url.protocol)) {
      return "";
    }
    if (url.username || url.password) {
      return "";
    }
    if (url.href.length > 2048) {
      return "";
    }
    return url.href;
  } catch {
    return "";
  }
}

export function resolveSiteWebsiteUrl(config, site) {
  return (
    normalizeWebsiteUrl(site?.websiteUrl) ||
    normalizeWebsiteUrl(config?.websiteUrl)
  );
}

export function resolveSiteChannel(config, site) {
  const siteChannel = normalizeSiteChannel(site?.channel);
  if (
    siteChannel === "whatsapp" ||
    siteChannel === "telegram" ||
    siteChannel === "website"
  ) {
    return siteChannel;
  }
  return normalizeChannel(config?.defaultChannel, "whatsapp");
}

function migrateConfig(saved) {
  const defaultChannel = normalizeChannel(saved?.defaultChannel, "whatsapp");
  const sites = Array.isArray(saved?.sites)
    ? saved.sites.map((site) => ({
        id: String(site?.id || "").trim().toLowerCase(),
        name: String(site?.name || "").trim(),
        channel: normalizeSiteChannel(site?.channel),
        websiteUrl: normalizeWebsiteUrl(site?.websiteUrl),
        message: String(site?.message || "").trim()
      }))
    : structuredClone(DEFAULT_CONFIG.sites);

  return {
    ...structuredClone(DEFAULT_CONFIG),
    ...saved,
    defaultChannel,
    number: String(saved?.number || "").replace(/\D/g, ""),
    telegramUsername: normalizeTelegramUsername(saved?.telegramUsername),
    websiteUrl: normalizeWebsiteUrl(saved?.websiteUrl),
    sites
  };
}

export async function readConfig() {
  const saved = await store().get(CONFIG_KEY, { type: "json" });
  if (!saved) return structuredClone(DEFAULT_CONFIG);
  return migrateConfig(saved);
}

export async function writeConfig(config) {
  await store().setJSON(CONFIG_KEY, config);
  return config;
}

export function sanitizeConfig(input, userEmail) {
  const defaultChannel = normalizeChannel(input?.defaultChannel, "whatsapp");
  const number = String(input?.number || "").replace(/\D/g, "");
  const telegramUsername = normalizeTelegramUsername(input?.telegramUsername);
  const websiteUrlRaw = String(input?.websiteUrl || "").trim();
  const websiteUrl = normalizeWebsiteUrl(websiteUrlRaw);

  if (websiteUrlRaw && !websiteUrl) {
    throw new Error(
      "O endereço padrão do site é inválido. Use um link completo começando com https:// ou http://."
    );
  }

  const defaultMessage = String(input?.defaultMessage || "").trim();
  if (!defaultMessage || defaultMessage.length > 500) {
    throw new Error("A mensagem padrão deve ter entre 1 e 500 caracteres.");
  }

  const rawSites = Array.isArray(input?.sites) ? input.sites.slice(0, 500) : [];
  const seen = new Set();
  const usedChannels = new Set([defaultChannel]);

  const sites = rawSites.map((site) => {
    const id = String(site?.id || "").trim().toLowerCase();
    const name = String(site?.name || "").trim();
    const channel = normalizeSiteChannel(site?.channel);
    const websiteUrlRaw = String(site?.websiteUrl || "").trim();
    const siteWebsiteUrl = normalizeWebsiteUrl(websiteUrlRaw);
    const message = String(site?.message || "").trim();

    if (!/^[a-z0-9_-]{2,40}$/.test(id)) {
      throw new Error(`O identificador "${id || "vazio"}" é inválido.`);
    }
    if (seen.has(id)) {
      throw new Error(`O identificador "${id}" está repetido.`);
    }
    seen.add(id);

    if (!name || name.length > 80) {
      throw new Error(`O nome do site "${id}" é inválido.`);
    }
    if (message.length > 500) {
      throw new Error(`A mensagem do site "${name}" ultrapassa 500 caracteres.`);
    }
    if (websiteUrlRaw && !siteWebsiteUrl) {
      throw new Error(
        `O link personalizado do site "${name}" é inválido. Use https:// ou http://.`
      );
    }

    if (channel !== "default") usedChannels.add(channel);

    return {
      id,
      name,
      channel,
      websiteUrl: siteWebsiteUrl,
      message
    };
  });

  if (usedChannels.has("whatsapp") && !/^\d{10,15}$/.test(number)) {
    throw new Error(
      "Existe pelo menos um site usando WhatsApp. Digite um número válido com DDI e DDD."
    );
  }

  if (usedChannels.has("telegram") && !telegramUsername) {
    throw new Error(
      "Existe pelo menos um site usando Telegram. Digite um usuário público válido do Telegram."
    );
  }

  if (defaultChannel === "website" && !websiteUrl) {
    throw new Error(
      "O destino padrão está como Site personalizado. Digite um endereço padrão válido."
    );
  }

  for (const site of sites) {
    const resolvedChannel =
      site.channel === "default" ? defaultChannel : site.channel;

    if (
      resolvedChannel === "website" &&
      !site.websiteUrl &&
      !websiteUrl
    ) {
      throw new Error(
        `O site "${site.name}" usa destino personalizado, mas nenhum endereço foi informado.`
      );
    }
  }

  return {
    defaultChannel,
    number,
    telegramUsername,
    websiteUrl,
    defaultMessage,
    sites,
    updatedAt: new Date().toISOString(),
    updatedBy: userEmail || null
  };
}
