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

function createField(labelText, element) {
  const label = document.createElement("label");
  label.append(document.createTextNode(labelText));
  label.append(element);
  return label;
}

function addSiteRow(site = { id: "", name: "", message: "" }) {
  const row = document.createElement("div");
  row.className = "site-row";

  const idInput = document.createElement("input");
  idInput.className = "site-id";
  idInput.value = site.id || "";
  idInput.placeholder = "playsim";
  idInput.maxLength = 40;
  idInput.required = true;

  const nameInput = document.createElement("input");
  nameInput.className = "site-name";
  nameInput.value = site.name || "";
  nameInput.placeholder = "PlaySim";
  nameInput.maxLength = 80;
  nameInput.required = true;

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
  removeButton.addEventListener("click", () => row.remove());

  row.append(
    createField("Identificador", idInput),
    createField("Nome", nameInput),
    createField("Mensagem", messageInput),
    removeButton
  );

  sitesList.append(row);
}

function collectConfig() {
  const sites = [...sitesList.querySelectorAll(".site-row")].map((row) => ({
    id: row.querySelector(".site-id").value.trim(),
    name: row.querySelector(".site-name").value.trim(),
    message: row.querySelector(".site-message").value.trim()
  }));

  return {
    number: $("#whatsappNumber").value.replace(/\D/g, ""),
    defaultMessage: $("#defaultMessage").value.trim(),
    sites
  };
}

function fillForm(config) {
  $("#whatsappNumber").value = config.number || "";
  $("#defaultMessage").value = config.defaultMessage || "";

  sitesList.replaceChildren();
  (config.sites || []).forEach(addSiteRow);

  if (!(config.sites || []).length) {
    addSiteRow({ id: "playsim", name: "PlaySim", message: "" });
  }

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
        throw new Error("O código do convite não foi encontrado. Abra novamente o link do e-mail.");
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

    setMessage(
      passwordMessage,
      "Senha salva. Abrindo o painel...",
      true
    );

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

$("#addSiteButton").addEventListener("click", () => addSiteRow());

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
      `<script src="${window.location.origin}/client/whatsapp.js" ` +
      `data-site="playsim" defer><\/script>`;

    show(dashboardView);
    await loadConfig();
  } catch (error) {
    show(loginView);
    setMessage(
      loginMessage,
      error.message || "Não foi possível abrir o painel."
    );
  }
}

initialize();
