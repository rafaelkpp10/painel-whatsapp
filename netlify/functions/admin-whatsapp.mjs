import { getUser, verifyRequestOrigin } from "@netlify/identity";
import { readConfig, sanitizeConfig, writeConfig } from "./lib/config-store.mjs";

const JSON_HEADERS = {
  "Content-Type": "application/json; charset=utf-8",
  "Cache-Control": "no-store",
  "X-Content-Type-Options": "nosniff"
};

function json(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: JSON_HEADERS });
}

export default async (request) => {
  const user = await getUser();
  if (!user) return json({ error: "Não autorizado." }, 401);

  if (request.method === "GET") {
    return json(await readConfig());
  }

  if (request.method === "PUT" || request.method === "POST") {
    try {
      verifyRequestOrigin(request);
      const input = await request.json();
      const config = sanitizeConfig(input, user.email);
      await writeConfig(config);
      return json(config);
    } catch (error) {
      return json({ error: error.message || "Dados inválidos." }, error?.status || 400);
    }
  }

  return new Response(null, { status: 405, headers: { Allow: "GET, PUT, POST" } });
};

export const config = {
  path: "/api/admin/whatsapp"
};
