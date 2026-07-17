import { getStore } from "@netlify/blobs";

const STORE_NAME = "whatsapp-central";
const CONFIG_KEY = "settings";

const CHANNELS = new Set(["whatsapp", "telegram"]);
const SITE_CHANNELS = new Set(["default", "whatsapp", "telegram"]);

export const DEFAULT_CONFIG = Object.freeze({
  defaultChannel: "whatsapp",
  number: "",
  telegramUsername: "",
  defaultMessage: "Olá! Vim pelo site e gostaria de mais informações.",
  sites: [
    {
      id: "playsim",
      name: "PlaySim",
      channel: "default",
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

export function resolveSiteChannel(config, site) {
  const siteChannel = normalizeSiteChannel(site?.channel);
  if (siteChannel === "whatsapp" || siteChannel === "telegram") {
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
        message: String(site?.message || "").trim()
      }))
    : structuredClone(DEFAULT_CONFIG.sites);

  return {
    ...structuredClone(DEFAULT_CONFIG),
    ...saved,
    defaultChannel,
    number: String(saved?.number || "").replace(/\D/g, ""),
    telegramUsername: normalizeTelegramUsername(saved?.telegramUsername),
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

    if (channel !== "default") usedChannels.add(channel);

    return { id, name, channel, message };
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

  return {
    defaultChannel,
    number,
    telegramUsername,
    defaultMessage,
    sites,
    updatedAt: new Date().toISOString(),
    updatedBy: userEmail || null
  };
}
