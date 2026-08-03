import { getStore } from "@netlify/blobs";
import { resolveSiteChannel } from "./config-store.mjs";

const CLICK_STORE_NAME = "whatsapp-click-events";
const MAX_SOURCE_LENGTH = 120;

function store() {
  return getStore({
    name: CLICK_STORE_NAME,
    consistency: "strong"
  });
}

function sanitizeSource(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9.-]/g, "")
    .slice(0, MAX_SOURCE_LENGTH);
}

function sourceFromReferrer(request) {
  const referrer = request.headers.get("referer");
  if (!referrer) return "";

  try {
    return sanitizeSource(new URL(referrer).hostname);
  } catch {
    return "";
  }
}

function isLikelyBot(request) {
  const userAgent = request.headers.get("user-agent") || "";
  return /bot|crawler|spider|preview|facebookexternalhit|headless|monitoring/i.test(
    userAgent
  );
}

export async function recordClick({
  request,
  siteId,
  siteName,
  channel,
  requestedSource
}) {
  if (isLikelyBot(request)) return;

  const now = new Date();
  const day = now.toISOString().slice(0, 10);
  const timestamp = now.getTime();
  const id = crypto.randomUUID();
  const source = sanitizeSource(requestedSource) || sourceFromReferrer(request);

  const key = `${day}/${siteId}/${timestamp}-${id}`;

  await store().setJSON(key, {
    siteId,
    siteName: siteName || siteId,
    channel: ["telegram", "website"].includes(channel)
      ? channel
      : "whatsapp",
    clickedAt: now.toISOString(),
    source: source || null
  });
}

function recentDateKeys(days) {
  const result = [];
  const today = new Date();

  for (let offset = 0; offset < days; offset += 1) {
    const date = new Date(today);
    date.setUTCDate(today.getUTCDate() - offset);
    result.push(date.toISOString().slice(0, 10));
  }

  return result;
}

function timestampFromKey(key) {
  const lastPart = key.split("/").at(-1) || "";
  const timestamp = Number(lastPart.split("-")[0]);
  return Number.isFinite(timestamp) ? timestamp : 0;
}

export async function readClickStats(config, days = 7) {
  const safeDays = Math.max(1, Math.min(Number(days) || 7, 30));
  const dates = recentDateKeys(safeDays);
  const today = dates[0];
  const knownSites = new Map(
    (config.sites || []).map((site) => [
      site.id,
      {
        id: site.id,
        name: site.name,
        channel: resolveSiteChannel(config, site),
        today: 0,
        period: 0,
        lastClickAt: null
      }
    ])
  );

  const pages = await Promise.all(
    dates.map((date) =>
      store().list({
        prefix: `${date}/`
      })
    )
  );

  for (const page of pages) {
    for (const blob of page.blobs || []) {
      const [date, siteId] = blob.key.split("/");
      if (!siteId) continue;

      if (!knownSites.has(siteId)) {
        knownSites.set(siteId, {
          id: siteId,
          name: siteId,
          channel: ["telegram", "website"].includes(config.defaultChannel)
            ? config.defaultChannel
            : "whatsapp",
          today: 0,
          period: 0,
          lastClickAt: null
        });
      }

      const siteStats = knownSites.get(siteId);
      siteStats.period += 1;

      if (date === today) {
        siteStats.today += 1;
      }

      const timestamp = timestampFromKey(blob.key);
      if (
        timestamp &&
        (!siteStats.lastClickAt || timestamp > Date.parse(siteStats.lastClickAt))
      ) {
        siteStats.lastClickAt = new Date(timestamp).toISOString();
      }
    }
  }

  const sites = [...knownSites.values()].sort((a, b) => {
    if (b.today !== a.today) return b.today - a.today;
    if (b.period !== a.period) return b.period - a.period;
    return a.name.localeCompare(b.name, "pt-BR");
  });

  return {
    generatedAt: new Date().toISOString(),
    periodDays: safeDays,
    totals: {
      today: sites.reduce((sum, site) => sum + site.today, 0),
      period: sites.reduce((sum, site) => sum + site.period, 0)
    },
    sites
  };
}
