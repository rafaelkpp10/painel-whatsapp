import "./admin.css";
import {
  acceptInvite,
  getUser,
  handleAuthCallback,
  login,
  logout,
  updateUser
} from "@netlify/identity";

const $ = (selector) => document.querySelector(selector);

const loadingView = $("#loadingView");
const passwordView = $("#passwordView");
const loginView = $("#loginView");
const dashboardView = $("#dashboardView");

const loginForm = $("#loginForm");
const passwordForm = $("#passwordForm");
const configForm = $("#configForm");
const sitesList = $("#sitesList");

const loginMessage = $("#loginMessage");
const passwordMessage = $("#passwordMessage");
const configMessage = $("#configMessage");
const saveStatus = $("#saveStatus");
const statsList = $("#statsList");
const statsMessage = $("#statsMessage");

let pendingAuthAction = null;
let pendingInviteToken = "";

function show(view) {
  [loadingView, passwordView, loginView, dashboardView].forEach((item) => {
    item.classList.add("hidden");
  });
  view.classList.remove("hidden");
}

function setMessage(element, message = "", success = false) {
  element.textContent = message;
  element.classList.toggle("success", success);
}

function cleanAuthTokenFromAddress() {
  history.replaceState(
    null,
    document.title,
    window.location.pathname + window.location.search
  );
}

function normalizeSiteId(value) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

function normalizeTelegramInput(value) {
  let normalized = String(value || "").trim();
  if (!normalized) return "";

  try {
    if (/^https?:\/\//i.test(normalized)) {
      const url = new URL(normalized);
      normalized = url.pathname.split("/").filter(Boolean)[0] || "";
    }
  } catch {
    return normalized;
  }

  return normalized
    .replace(/^@+/, "")
    .split(/[/?#]/)[0]
    .trim();
}


function normalizeWebsiteInput(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";

  try {
    const url = new URL(raw);
    if (!["http:", "https:"].includes(url.protocol)) {
      return raw;
    }
    return url.href;
  } catch {
    return raw;
  }
}

function createField(labelText, element) {
  const label = document.createElement("label");
  label.append(document.createTextNode(labelText));
  label.append(element);
  return label;
}

function createChannelSelect(value = "default") {
  const select = document.createElement("select");
  select.className = "site-channel";

  [
    ["default", "Usar canal padrão"],
    ["whatsapp", "WhatsApp"],
    ["telegram", "Telegram"],
    ["website", "Site personalizado"]
  ].forEach(([optionValue, label]) => {
    const option = document.createElement("option");
    option.value = optionValue;
    option.textContent = label;
    select.append(option);
  });

  select.value = ["default", "whatsapp", "telegram", "website"].includes(value)
    ? value
    : "default";
  select.addEventListener("change", updateChannelRequirements);
  return select;
}

function addSiteRow(
  site = {
    id: "",
    name: "",
    channel: "default",
    websiteUrl: "",
    message: ""
  }
) {
  const row = document.createElement("div");
  row.className = "site-row";

  const idInput = document.createElement("input");
  idInput.className = "site-id";
  idInput.value = site.id || "";
  idInput.placeholder = "playsim1";
  idInput.maxLength = 40;
  idInput.required = true;

  const nameInput = document.createElement("input");
  nameInput.className = "site-name";
  nameInput.value = site.name || "";
  nameInput.placeholder = "PlaySim 1";
  nameInput.maxLength = 80;
  nameInput.required = true;

  const channelSelect = createChannelSelect(site.channel || "default");

  const websiteInput = document.createElement("input");
  websiteInput.type = "url";
  websiteInput.className = "site-website-url";
  websiteInput.value = site.websiteUrl || "";
  websiteInput.placeholder = "https://destino-especifico.com";
  websiteInput.maxLength = 2048;

  websiteInput.addEventListener("blur", () => {
    websiteInput.value = normalizeWebsiteInput(websiteInput.value);
  });

  const messageInput = document.createElement("textarea");
  messageInput.className = "site-message";
  messageInput.value = site.message || "";
  messageInput.placeholder = "Mensagem específica deste site";
  messageInput.maxLength = 500;
  messageInput.rows = 2;

  nameInput.addEventListener("blur", () => {
    if (!idInput.value.trim()) {
      idInput.value = normalizeSiteId(nameInput.value);
    }
  });

  idInput.addEventListener("input", () => {
    const cursor = idInput.selectionStart;
    idInput.value = normalizeSiteId(idInput.value);
    idInput.setSelectionRange(cursor, cursor);
  });

  const removeButton = document.createElement("button");
  removeButton.type = "button";
  removeButton.className = "danger-button";
  removeButton.textContent = "Remover";
  removeButton.addEventListener("click", () => {
    row.remove();
    updateChannelRequirements();
  });

  const idField = createField("Identificador", idInput);
  const nameField = createField("Nome", nameInput);
  const channelField = createField("Destino", channelSelect);
  const websiteUrlField = createField(
    "Link específico do site (opcional)",
    websiteInput
  );
  websiteUrlField.className = "site-url-field";

  const messageField = createField("Mensagem", messageInput);
  messageField.className = "site-message-field";

  row.append(
    idField,
    nameField,
    channelField,
    removeButton,
    websiteUrlField,
    messageField
  );

  sitesList.append(row);
  updateChannelRequirements();
}

function getUsedChannels() {
  const channels = new Set([$("#defaultChannel").value]);

  sitesList.querySelectorAll(".site-channel").forEach((select) => {
    if (select.value !== "default") channels.add(select.value);
  });

  return channels;
}

function updateChannelRequirements() {
  const channels = getUsedChannels();
  const defaultChannel = $("#defaultChannel").value;
  const whatsappNeeded = channels.has("whatsapp");
  const telegramNeeded = channels.has("telegram");
  const websiteNeeded = channels.has("website");

  const numberInput = $("#whatsappNumber");
  const telegramInput = $("#telegramUsername");
  const websiteInput = $("#websiteUrl");
  const whatsappField = $("#whatsappField");
  const telegramField = $("#telegramField");
  const websiteField = $("#websiteField");

  numberInput.required = whatsappNeeded;
  telegramInput.required = telegramNeeded;
  websiteInput.required = defaultChannel === "website";

  whatsappField.classList.toggle("needed", whatsappNeeded);
  telegramField.classList.toggle("needed", telegramNeeded);
  websiteField.classList.toggle("needed", websiteNeeded);

  sitesList.querySelectorAll(".site-row").forEach((row) => {
    const selected = row.querySelector(".site-channel")?.value || "default";
    const resolved = selected === "default" ? defaultChannel : selected;
    const field = row.querySelector(".site-url-field");
    field?.classList.toggle("needed", resolved === "website");
  });

  const labels = [];
  if (whatsappNeeded) labels.push("WhatsApp");
  if (telegramNeeded) labels.push("Telegram");
  if (websiteNeeded) labels.push("Site personalizado");

  const summary = $("#channelRequirementSummary");
  if (labels.length > 1) {
    summary.textContent =
      `Destinos em uso: ${labels.join(", ")}. Preencha os dados correspondentes.`;
  } else if (websiteNeeded) {
    summary.textContent =
      "Modo Site personalizado ativo. Informe o endereço padrão ou um link específico em cada cadastro.";
  } else if (telegramNeeded) {
    summary.textContent =
      "Modo Telegram ativo. O número do WhatsApp e o endereço do site podem ficar vazios.";
  } else {
    summary.textContent =
      "Modo WhatsApp ativo. Os campos de Telegram e site personalizado podem ficar vazios.";
  }
}

function collectConfig() {
  const sites = [...sitesList.querySelectorAll(".site-row")].map((row) => ({
    id: row.querySelector(".site-id").value.trim(),
    name: row.querySelector(".site-name").value.trim(),
    channel: row.querySelector(".site-channel").value,
    websiteUrl: normalizeWebsiteInput(
      row.querySelector(".site-website-url").value
    ),
    message: row.querySelector(".site-message").value.trim()
  }));

  return {
    defaultChannel: $("#defaultChannel").value,
    number: $("#whatsappNumber").value.replace(/\D/g, ""),
    telegramUsername: normalizeTelegramInput($("#telegramUsername").value),
    websiteUrl: normalizeWebsiteInput($("#websiteUrl").value),
    defaultMessage: $("#defaultMessage").value.trim(),
    sites
  };
}

function fillForm(config) {
  $("#defaultChannel").value =
    ["whatsapp", "telegram", "website"].includes(config.defaultChannel)
      ? config.defaultChannel
      : "whatsapp";
  $("#whatsappNumber").value = config.number || "";
  $("#telegramUsername").value = config.telegramUsername || "";
  $("#websiteUrl").value = config.websiteUrl || "";
  $("#defaultMessage").value = config.defaultMessage || "";

  sitesList.replaceChildren();
  (config.sites || []).forEach(addSiteRow);

  if (!(config.sites || []).length) {
    addSiteRow({
      id: "playsim",
      name: "PlaySim",
      channel: "default",
      websiteUrl: "",
      message: ""
    });
  }

  updateChannelRequirements();

  saveStatus.textContent = config.updatedAt
    ? `Atualizado ${new Date(config.updatedAt).toLocaleString("pt-BR")}`
    : "Ainda não salvo";

  saveStatus.classList.toggle("saved", Boolean(config.updatedAt));
}

async function loadConfig() {
  const response = await fetch("/api/admin/whatsapp", {
    cache: "no-store"
  });

  if (response.status === 401) {
    throw new Error("Sua sessão expirou. Entre novamente.");
  }

  if (!response.ok) {
    throw new Error("Não foi possível carregar as configurações.");
  }

  fillForm(await response.json());
}

function formatDateTime(value) {
  if (!value) return "Nenhum clique nos últimos 7 dias";

  return new Date(value).toLocaleString("pt-BR", {
    dateStyle: "short",
    timeStyle: "short"
  });
}

function channelLabel(channel) {
  if (channel === "telegram") return "Telegram";
  if (channel === "website") return "Site";
  return "WhatsApp";
}

function createStatsCard(site) {
  const card = document.createElement("article");
  card.className = "site-stat-card";

  const header = document.createElement("div");
  header.className = "site-stat-header";

  const identity = document.createElement("div");
  const titleLine = document.createElement("div");
  titleLine.className = "site-stat-title-line";

  const title = document.createElement("strong");
  title.textContent = site.name || site.id;

  const channel = ["telegram", "website"].includes(site.channel)
    ? site.channel
    : "whatsapp";
  const channelBadge = document.createElement("span");
  channelBadge.className = `channel-badge ${channel}`;
  channelBadge.textContent = channelLabel(channel);

  titleLine.append(title, channelBadge);

  const id = document.createElement("code");
  id.textContent = site.id;

  identity.append(titleLine, id);

  const testLink = document.createElement("a");
  testLink.className = `test-link ${channel}`;
  testLink.href = `/zap/${encodeURIComponent(site.id)}?test=1`;
  testLink.target = "_blank";
  testLink.rel = "noopener noreferrer";
  testLink.textContent = `Testar ${channelLabel(channel)}`;

  header.append(identity, testLink);

  const numbers = document.createElement("div");
  numbers.className = "site-stat-numbers";

  const today = document.createElement("span");
  today.innerHTML =
    `<small>Hoje</small><strong>${Number(site.today || 0)}</strong>`;

  const period = document.createElement("span");
  period.innerHTML =
    `<small>7 dias</small><strong>${Number(site.period || 0)}</strong>`;

  numbers.append(today, period);

  const last = document.createElement("p");
  last.className = "site-last-click";
  last.textContent = `Último clique: ${formatDateTime(site.lastClickAt)}`;

  card.append(header, numbers, last);
  return card;
}

function renderStats(stats) {
  $("#todayClicks").textContent = String(stats?.totals?.today || 0);
  $("#periodClicks").textContent = String(stats?.totals?.period || 0);
  $("#registeredSites").textContent = String(stats?.sites?.length || 0);

  statsList.replaceChildren();

  const sites = Array.isArray(stats?.sites) ? stats.sites : [];

  if (!sites.length) {
    const empty = document.createElement("p");
    empty.className = "muted";
    empty.textContent = "Nenhum site cadastrado.";
    statsList.append(empty);
    return;
  }

  sites.forEach((site) => {
    statsList.append(createStatsCard(site));
  });
}

async function loadStats() {
  const button = $("#refreshStatsButton");
  button.disabled = true;
  button.textContent = "Atualizando...";
  setMessage(statsMessage);

  try {
    const response = await fetch("/api/admin/stats?days=7", {
      cache: "no-store"
    });

    const result = await response.json().catch(() => ({}));

    if (response.status === 401) {
      throw new Error("Sua sessão expirou. Entre novamente.");
    }

    if (!response.ok) {
      throw new Error(
        result.error || "Não foi possível carregar os cliques."
      );
    }

    renderStats(result);
    setMessage(
      statsMessage,
      `Atualizado às ${new Date(result.generatedAt).toLocaleTimeString("pt-BR")}.`,
      true
    );
  } catch (error) {
    setMessage(
      statsMessage,
      error.message || "Erro ao carregar os cliques."
    );
  } finally {
    button.disabled = false;
    button.textContent = "Atualizar cliques";
  }
}

$("#refreshStatsButton").addEventListener("click", loadStats);
$("#defaultChannel").addEventListener("change", updateChannelRequirements);
$("#telegramUsername").addEventListener("blur", (event) => {
  event.target.value = normalizeTelegramInput(event.target.value);
});
$("#websiteUrl").addEventListener("blur", (event) => {
  event.target.value = normalizeWebsiteInput(event.target.value);
});

function openPasswordView(action) {
  pendingAuthAction = action;
  setMessage(passwordMessage);

  if (action === "invite") {
    $("#passwordEyebrow").textContent = "ATIVAR ACESSO";
    $("#passwordTitle").textContent = "Crie sua senha";
    $("#passwordDescription").textContent =
      "Defina a senha que será usada para entrar no painel.";
    $("#passwordButton").textContent = "Criar senha e entrar";
  } else {
    $("#passwordEyebrow").textContent = "RECUPERAR ACESSO";
    $("#passwordTitle").textContent = "Defina uma nova senha";
    $("#passwordDescription").textContent =
      "Escolha uma nova senha para sua conta administrativa.";
    $("#passwordButton").textContent = "Salvar nova senha";
  }

  show(passwordView);
}

passwordForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  setMessage(passwordMessage);

  const password = $("#newPassword").value;
  const confirmation = $("#confirmPassword").value;
  const button = $("#passwordButton");
  const originalText = button.textContent;

  if (password.length < 8) {
    setMessage(passwordMessage, "A senha precisa ter pelo menos 8 caracteres.");
    return;
  }

  if (password !== confirmation) {
    setMessage(passwordMessage, "As duas senhas não são iguais.");
    return;
  }

  button.disabled = true;
  button.textContent = "Salvando...";

  try {
    if (pendingAuthAction === "invite") {
      if (!pendingInviteToken) {
        throw new Error(
          "O código do convite não foi encontrado. Abra novamente o link do e-mail."
        );
      }

      await acceptInvite(pendingInviteToken, password);
    } else if (pendingAuthAction === "recovery") {
      await updateUser({ password });
    } else {
      throw new Error("A solicitação de senha não é mais válida.");
    }

    pendingInviteToken = "";
    pendingAuthAction = null;
    cleanAuthTokenFromAddress();

    setMessage(passwordMessage, "Senha salva. Abrindo o painel...", true);

    window.setTimeout(() => {
      window.location.replace("/admin/");
    }, 700);
  } catch (error) {
    setMessage(
      passwordMessage,
      error?.message ||
        "Não foi possível salvar a senha. Solicite um novo convite."
    );
    button.disabled = false;
    button.textContent = originalText;
  }
});

loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  setMessage(loginMessage);

  const button = $("#loginButton");
  button.disabled = true;
  button.textContent = "Entrando...";

  try {
    await login($("#email").value.trim(), $("#password").value);
    window.location.reload();
  } catch (error) {
    setMessage(
      loginMessage,
      "E-mail ou senha inválidos, ou usuário ainda não confirmado."
    );
    button.disabled = false;
    button.textContent = "Entrar";
  }
});

$("#logoutButton").addEventListener("click", async () => {
  await logout();
  window.location.reload();
});

$("#addSiteButton").addEventListener("click", () => {
  addSiteRow();
});

configForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  setMessage(configMessage);

  const button = $("#saveButton");
  button.disabled = true;
  button.textContent = "Salvando...";

  try {
    const payload = collectConfig();

    const response = await fetch("/api/admin/whatsapp", {
      method: "PUT",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });

    const result = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(result.error || "Não foi possível salvar.");
    }

    fillForm(result);
    setMessage(configMessage, "Alterações salvas com sucesso.", true);
    await loadStats();
  } catch (error) {
    setMessage(
      configMessage,
      error.message || "Erro ao salvar as alterações."
    );
  } finally {
    button.disabled = false;
    button.textContent = "Salvar alterações";
  }
});

async function initialize() {
  let callbackResult = null;

  try {
    callbackResult = await handleAuthCallback();
  } catch (error) {
    show(loginView);
    setMessage(
      loginMessage,
      "O convite não pôde ser processado. Abra novamente o link recebido por e-mail."
    );
    return;
  }

  if (callbackResult?.type === "invite" && callbackResult.token) {
    pendingInviteToken = callbackResult.token;
    cleanAuthTokenFromAddress();
    openPasswordView("invite");
    return;
  }

  if (callbackResult?.type === "recovery") {
    cleanAuthTokenFromAddress();
    openPasswordView("recovery");
    return;
  }

  if (callbackResult) {
    cleanAuthTokenFromAddress();
  }

  try {
    const user = await getUser();

    if (!user) {
      show(loginView);
      return;
    }

    $("#userInfo").textContent = `Conectado como ${user.email}`;
    $("#integrationCode").textContent =
      `<a href="${window.location.origin}/zap/playsim1">Falar com atendimento</a>\n\n` +
      `<script src="${window.location.origin}/client/whatsapp.js" ` +
      `data-site="playsim1" defer><\/script>`;

    show(dashboardView);
    await loadConfig();
    await loadStats();
  } catch (error) {
    show(loginView);
    setMessage(
      loginMessage,
      error.message || "Não foi possível abrir o painel."
    );
  }
}

initialize();
