import { getStore } from "@netlify/blobs";

const STORE_NAME = "whatsapp-central";
const CONFIG_KEY = "settings";

export const DEFAULT_CONFIG = Object.freeze({
  number: "",
  defaultMessage: "Olá! Vim pelo site e gostaria de mais informações.",
  sites: [
    {
      id: "playsim",
      name: "PlaySim",
      message: "Olá! Vim pelo site PlaySim e gostaria de conhecer os planos disponíveis."
    }
  ],
  updatedAt: null,
  updatedBy: null
});

function store() {
  return getStore({ name: STORE_NAME, consistency: "strong" });
}

export async function readConfig() {
  const saved = await store().get(CONFIG_KEY, { type: "json" });
  if (!saved) return structuredClone(DEFAULT_CONFIG);
  return {
    ...structuredClone(DEFAULT_CONFIG),
    ...saved,
    sites: Array.isArray(saved.sites) ? saved.sites : structuredClone(DEFAULT_CONFIG.sites)
  };
}

export async function writeConfig(config) {
  await store().setJSON(CONFIG_KEY, config);
  return config;
}

export function sanitizeConfig(input, userEmail) {
  const number = String(input?.number || "").replace(/\D/g, "");
  if (!/^\d{10,15}$/.test(number)) {
    throw new Error("Digite um número válido com DDI e DDD, usando entre 10 e 15 números.");
  }

  const defaultMessage = String(input?.defaultMessage || "").trim();
  if (!defaultMessage || defaultMessage.length > 500) {
    throw new Error("A mensagem padrão deve ter entre 1 e 500 caracteres.");
  }

  const rawSites = Array.isArray(input?.sites) ? input.sites.slice(0, 50) : [];
  const seen = new Set();
  const sites = rawSites.map((site) => {
    const id = String(site?.id || "").trim().toLowerCase();
    const name = String(site?.name || "").trim();
    const message = String(site?.message || "").trim();

    if (!/^[a-z0-9_-]{2,40}$/.test(id)) {
      throw new Error(`O identificador "${id || "vazio"}" é inválido.`);
    }
    if (seen.has(id)) throw new Error(`O identificador "${id}" está repetido.`);
    seen.add(id);
    if (!name || name.length > 80) throw new Error(`O nome do site "${id}" é inválido.`);
    if (message.length > 500) throw new Error(`A mensagem do site "${name}" ultrapassa 500 caracteres.`);

    return { id, name, message };
  });

  return {
    number,
    defaultMessage,
    sites,
    updatedAt: new Date().toISOString(),
    updatedBy: userEmail || null
  };
}
