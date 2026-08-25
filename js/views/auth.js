// =========================================================
// A ROLE PLAY - AUTH VIEW
// =========================================================

import {
  auth,
  db
} from "../firebase-config.js";

import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  updateProfile
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

import {
  doc,
  setDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

export function render() {

  // Injeta a tag de estilo no <head> apenas se ainda não existir
  if (!document.getElementById("auth-view-styles")) {
    const style = document.createElement("style");
    style.id = "auth-view-styles";
    style.textContent = `
      .auth-view {
        width: 100%;
        min-height: 100vh;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 24px;
        position: relative;
        overflow-x: hidden;
        background:
          radial-gradient(
            circle at 50% 20%,
            color-mix(in srgb, var(--accent-primary) 12%, transparent),
            transparent 42%
          ),
          var(--bg-primary);
        color: var(--text-primary);
      }

      .auth-view::before {
        content: "";
        position: absolute;
        inset: 0;
        pointer-events: none;
        opacity: .18;
        background-image:
          linear-gradient(
            135deg,
            transparent 45%,
            var(--border-color-dark) 46%,
            transparent 47%
          );
        background-size: 38px 38px;
      }

      .auth-container {
        width: 100%;
        max-width: 440px;
        position: relative;
        z-index: 1;
        display: flex;
        flex-direction: column;
        gap: 22px;
      }

      .auth-brand {
        text-align: center;
        padding: 8px 0 4px;
      }

      .auth-brand-mark {
        width: 62px;
        height: 62px;
        margin: 0 auto 14px;
        display: flex;
        align-items: center;
        justify-content: center;
        border-radius: 18px;
        background:
          linear-gradient(
            145deg,
            var(--accent-primary-light),
            var(--accent-primary-dark)
          );
        border: 1px solid var(--accent-secondary-dark);
        box-shadow:
          0 12px 35px rgba(0, 0, 0, .35),
          inset 0 1px 0 rgba(255,255,255,.12);
      }

      .auth-brand-mark svg {
        width: 34px;
        height: 34px;
        fill: none;
        stroke: var(--color-gold-bright);
        stroke-width: 1.7;
      }

      .auth-brand h1 {
        margin: 0;
        font-family: Georgia, "Times New Roman", serif;
        font-size: clamp(2rem, 9vw, 2.65rem);
        line-height: 1;
        letter-spacing: -.035em;
        color: var(--text-primary);
      }

      .auth-brand h1 span {
        color: var(--accent-secondary-light);
      }

      .auth-brand p {
        margin: 10px 0 0;
        color: var(--text-secondary);
        font-size: .9rem;
        letter-spacing: .04em;
      }

      .auth-form {
        width: 100%;
        padding: 26px;
        border-radius: 20px;
        background:
          linear-gradient(
            145deg,
            color-mix(in srgb, var(--bg-surface-light) 96%, white),
            var(--bg-surface)
          );
        border: 1px solid var(--border-color);
        box-shadow:
          0 24px 60px rgba(0, 0, 0, .38),
          inset 0 1px 0 rgba(255,255,255,.035);
        position: relative;
        overflow: hidden;
      }

      .auth-form::before {
        content: "";
        position: absolute;
        top: 0;
        left: 28px;
        right: 28px;
        height: 2px;
        background:
          linear-gradient(
            90deg,
            transparent,
            var(--accent-secondary),
            transparent
          );
        opacity: .8;
      }

      .auth-form-header {
        margin-bottom: 24px;
      }

      .auth-form-header h2 {
        margin: 0 0 6px;
        font-family: Georgia, "Times New Roman", serif;
        font-size: 1.55rem;
        color: var(--text-primary);
      }

      .auth-form-header p {
        margin: 0;
        color: var(--text-secondary);
        font-size: .9rem;
        line-height: 1.55;
      }

      .form-field {
        margin-bottom: 17px;
      }

      .form-field label {
        display: block;
        margin-bottom: 7px;
        color: var(--text-secondary);
        font-size: .82rem;
        font-weight: 650;
        letter-spacing: .025em;
      }

      .form-field input {
        width: 100%;
        min-height: 50px;
        padding: 0 15px;
        border-radius: 12px;
        border: 1px solid var(--border-color);
        outline: none;
        background:
          color-mix(
            in srgb,
            var(--bg-primary) 70%,
            var(--bg-surface)
          );
        color: var(--text-primary);
        font-family: inherit;
        font-size: .95rem;
        transition:
          border-color .2s ease,
          box-shadow .2s ease,
          background .2s ease,
          transform .2s ease;
      }

      .form-field input::placeholder {
        color: var(--text-muted);
        opacity: .8;
      }

      .form-field input:hover {
        border-color: var(--border-color-light);
      }

      .form-field input:focus {
        border-color: var(--accent-secondary);
        background: var(--bg-surface);
        box-shadow:
          0 0 0 3px
          color-mix(
            in srgb,
            var(--accent-secondary) 14%,
            transparent
          );
      }

      .auth-message {
        min-height: 20px;
        margin: 2px 0 12px;
        color: var(--color-danger);
        font-size: .82rem;
        line-height: 1.45;
      }

      .auth-message:empty {
        min-height: 0;
        margin: 0;
      }

      .auth-submit {
        width: 100%;
        min-height: 51px;
        border: 1px solid var(--accent-primary-light);
        border-radius: 12px;
        background:
          linear-gradient(
            135deg,
            var(--accent-primary-light),
            var(--accent-primary)
          );
        color: var(--text-primary);
        font-family: inherit;
        font-size: .95rem;
        font-weight: 700;
        letter-spacing: .02em;
        cursor: pointer;
        box-shadow:
          0 8px 20px rgba(0, 0, 0, .25),
          inset 0 1px 0 rgba(255,255,255,.1);
        transition:
          transform .15s ease,
          filter .2s ease,
          box-shadow .2s ease;
      }

      .auth-submit:hover {
        filter: brightness(1.1);
        box-shadow:
          0 10px 26px rgba(0, 0, 0, .32),
          0 0 18px
          color-mix(
            in srgb,
            var(--accent-primary) 20%,
            transparent
          );
      }

      .auth-submit:active {
        transform: scale(.985);
      }

      .auth-submit:disabled {
        opacity: .6;
        cursor: wait;
        filter: none;
      }

      .auth-switch {
        display: flex;
        align-items: center;
        justify-content: center;
        flex-wrap: wrap;
        gap: 5px;
        margin-top: 20px;
        color: var(--text-muted);
        font-size: .82rem;
        text-align: center;
      }

      .auth-link {
        border: 0;
        padding: 3px;
        background: transparent;
        color: var(--accent-secondary-light);
        font: inherit;
        font-weight: 700;
        cursor: pointer;
        transition: color .2s ease;
      }

      .auth-link:hover {
        color: var(--color-gold-bright);
        text-decoration: underline;
      }

      @media (max-width: 480px) {
        .auth-view {
          padding: 18px;
          align-items: flex-start;
          padding-top: 5vh;
        }

        .auth-form {
          padding: 22px 19px;
          border-radius: 18px;
        }

        .auth-brand h1 {
          font-size: 2.15rem;
        }
      }

      @media (max-height: 700px) {
        .auth-view {
          align-items: flex-start;
          padding-top: 24px;
          overflow-y: auto;
        }
      }
    `;
    document.head.appendChild(style);
  }

  const container = document.createElement("div");
  container.className = "auth-view";

  container.insertAdjacentHTML(
    "beforeend",
    `
      <div class="auth-container">
        <div class="auth-brand">
          <div class="auth-brand-mark">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M6 4h12v16H6z" />
              <path d="M9 7h6M9 11h6M9 15h4" />
            </svg>
          </div>
          <h1>A <span>Role</span> Play</h1>
          <p>Entre no seu mundo.</p>
        </div>

        <section class="auth-form" id="auth-form-container">
          <div class="auth-form-header">
            <h2 id="auth-title">Entrar</h2>
            <p id="auth-description">Acesse suas mesas e continue sua aventura.</p>
          </div>

          <form id="auth-form">
            <div class="form-field" id="username-field" hidden>
              <label for="auth-username">Nome de usuário</label>
              <input
                id="auth-username"
                name="username"
                type="text"
                autocomplete="username"
                placeholder="Como você será conhecido?"
                minlength="3"
                maxlength="30"
              >
            </div>

            <div class="form-field">
              <label for="auth-email">E-mail</label>
              <input
                id="auth-email"
                name="email"
                type="email"
                autocomplete="email"
                placeholder="seu@email.com"
                required
              >
            </div>

            <div class="form-field">
              <label for="auth-password">Senha</label>
              <input
                id="auth-password"
                name="password"
                type="password"
                autocomplete="current-password"
                placeholder="Sua senha"
                required
              >
            </div>

            <div class="auth-message" id="auth-message" aria-live="polite"></div>

            <button type="submit" class="auth-submit" id="auth-submit">
              Entrar
            </button>
          </form>

          <div class="auth-switch">
            <span id="auth-switch-text">Ainda não possui uma conta?</span>
            <button type="button" class="auth-link" id="auth-switch-button">
              Criar conta
            </button>
          </div>
        </section>
      </div>
    `
  );

  const authForm = container.querySelector("#auth-form");
  const usernameField = container.querySelector("#username-field");
  const usernameInput = container.querySelector("#auth-username");
  const emailInput = container.querySelector("#auth-email");
  const passwordInput = container.querySelector("#auth-password");
  const title = container.querySelector("#auth-title");
  const description = container.querySelector("#auth-description");
  const switchText = container.querySelector("#auth-switch-text");
  const switchButton = container.querySelector("#auth-switch-button");
  const submitButton = container.querySelector("#auth-submit");

  let mode = "login";

  function setMode(newMode) {
    mode = newMode;
    const register = mode === "register";

    usernameField.hidden = !register;
    usernameInput.required = register;

    title.textContent = register ? "Criar conta" : "Entrar";
    description.textContent = register
      ? "Crie seu perfil e comece sua aventura."
      : "Acesse suas mesas e continue sua aventura.";

    switchText.textContent = register
      ? "Já possui uma conta?"
      : "Ainda não possui uma conta?";

    switchButton.textContent = register ? "Voltar para login" : "Criar conta";
    submitButton.textContent = register ? "Criar conta" : "Entrar";

    passwordInput.autocomplete = register ? "new-password" : "current-password";
    passwordInput.placeholder = register ? "Crie uma senha" : "Sua senha";

    clearMessages(container);

    const targetInput = register ? usernameInput : emailInput;
    targetInput.focus({ preventScroll: true });
  }

  switchButton.addEventListener("click", () => {
    setMode(mode === "login" ? "register" : "login");
  });

  authForm.addEventListener("submit", async event => {
    event.preventDefault();
    clearMessages(container);

    const email = emailInput.value.trim();
    const password = passwordInput.value;
    const username = usernameInput.value.trim();

    if (!email || !password || (mode === "register" && !username)) {
      showMessage(container, "auth", "Preencha todos os campos.");
      return;
    }

    if (mode === "register") {
      if (username.length < 3) {
        showMessage(container, "auth", "O nome de usuário precisa ter pelo menos 3 caracteres.");
        return;
      }

      if (username.length > 30) {
        showMessage(container, "auth", "O nome de usuário pode ter no máximo 30 caracteres.");
        return;
      }

      if (password.length < 6) {
        showMessage(container, "auth", "A senha precisa ter pelo menos 6 caracteres.");
        return;
      }

      setLoading(submitButton, true, "Criando...");

      try {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;

        await updateProfile(user, { displayName: username });

        await setDoc(doc(db, "users", user.uid), {
          uid: user.uid,
          username: username,
          email: email,
          photoURL: null,
          friends: [],
          createdAt: serverTimestamp()
        });

        window.router.navigate("/home");
      } catch (error) {
        console.error("Erro ao criar conta:", error);
        showMessage(container, "auth", translateAuthError(error));
      } finally {
        setLoading(submitButton, false, "Criar conta");
      }

      return;
    }

    setLoading(submitButton, true, "Entrando...");

    try {
      await signInWithEmailAndPassword(auth, email, password);
      window.router.navigate("/home");
    } catch (error) {
      console.error("Erro ao fazer login:", error);
      showMessage(container, "auth", translateAuthError(error));
    } finally {
      setLoading(submitButton, false, "Entrar");
    }
  });

  return container;
}

function showMessage(container, type, message) {
  const element = container.querySelector(`#${type}-message`);
  if (!element) return;
  element.textContent = message;
}

function clearMessages(container) {
  const messages = container.querySelectorAll(".auth-message");
  messages.forEach(message => {
    message.textContent = "";
  });
}

function setLoading(button, loading, text) {
  button.disabled = loading;
  button.textContent = text;
}

function translateAuthError(error) {
  switch (error.code) {
    case "auth/invalid-email":
      return "O e-mail informado não é válido.";
    case "auth/user-not-found":
      return "Não existe uma conta com este e-mail.";
    case "auth/wrong-password":
      return "A senha está incorreta.";
    case "auth/invalid-credential":
      return "E-mail ou senha incorretos.";
    case "auth/email-already-in-use":
      return "Este e-mail já está cadastrado.";
    case "auth/weak-password":
      return "A senha é muito fraca.";
    case "auth/too-many-requests":
      return "Muitas tentativas. Aguarde um pouco e tente novamente.";
    case "auth/network-request-failed":
      return "Não foi possível conectar ao servidor.";
    case "auth/operation-not-allowed":
      return "O método de autenticação por e-mail e senha não está habilitado no Firebase.";
    default:
      return "Não foi possível concluir a operação. Tente novamente.";
  }
}
