import { getUser } from "@netlify/identity";
import { readConfig } from "./lib/config-store.mjs";
import { readClickStats } from "./lib/click-store.mjs";

const JSON_HEADERS = {
  "Content-Type": "application/json; charset=utf-8",
  "Cache-Control": "no-store, max-age=0",
  "X-Content-Type-Options": "nosniff"
};

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: JSON_HEADERS
  });
}

export default async (request) => {
  const user = await getUser();
  if (!user) {
    return json({ error: "Não autorizado." }, 401);
  }

  if (request.method !== "GET") {
    return json({ error: "Método não permitido." }, 405);
  }

  try {
    const url = new URL(request.url);
    const days = Math.max(
      1,
      Math.min(Number(url.searchParams.get("days")) || 7, 30)
    );
    const config = await readConfig();
    return json(await readClickStats(config, days));
  } catch (error) {
    console.error("[WhatsApp Stats] Falha ao carregar estatísticas.", error);
    return json(
      { error: "Não foi possível carregar os cliques." },
      500
    );
  }
};
