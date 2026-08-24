// =========================================================
// A ROLE PLAY
// AUTH VIEW
// Login e Cadastro
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


// =========================================================
// RENDER
// =========================================================

export function render() {

  const container = document.createElement("div");

  container.className = "auth-view";


  // =======================================================
  // ESTILO DA VIEW
  // =======================================================

  const style = document.createElement("style");

  style.textContent = `

    /* =====================================================
       AUTH VIEW
       ===================================================== */

    .auth-view {

      width: 100%;
      min-height: 100dvh;

      display: flex;
      align-items: center;
      justify-content: center;

      padding: 24px;

      position: relative;

      overflow: hidden;

      background:
        radial-gradient(
          circle at 50% 20%,
          color-mix(
            in srgb,
            var(--accent-primary) 12%,
            transparent
          ),
          transparent 42%
        ),
        var(--bg-primary);

      color: var(--text-primary);

    }


    /* =====================================================
       TEXTURA DECORATIVA
       ===================================================== */

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


    /* =====================================================
       CONTAINER
       ===================================================== */

    .auth-container {

      width: 100%;
      max-width: 440px;

      position: relative;
      z-index: 1;

      display: flex;
      flex-direction: column;

      gap: 22px;

    }


    /* =====================================================
       MARCA
       ===================================================== */

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

      font-family:
        Georgia,
        "Times New Roman",
        serif;

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


    /* =====================================================
       FORM CARD
       ===================================================== */

    .auth-form {

      width: 100%;

      padding: 26px;

      border-radius: 20px;

      background:
        linear-gradient(
          145deg,
          color-mix(
            in srgb,
            var(--bg-surface-light) 96%,
            white
          ),
          var(--bg-surface)
        );

      border: 1px solid var(--border-color);

      box-shadow:
        0 24px 60px rgba(0, 0, 0, .38),
        inset 0 1px 0 rgba(255,255,255,.035);

      position: relative;

      overflow: hidden;

    }


    /* detalhe dourado superior */

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


    /* =====================================================
       CABEÇALHO DO FORMULÁRIO
       ===================================================== */

    .auth-form-header {

      margin-bottom: 24px;

    }


    .auth-form-header h2 {

      margin: 0 0 6px;

      font-family:
        Georgia,
        "Times New Roman",
        serif;

      font-size: 1.55rem;

      color: var(--text-primary);

    }


    .auth-form-header p {

      margin: 0;

      color: var(--text-secondary);

      font-size: .9rem;

      line-height: 1.55;

    }


    /* =====================================================
       CAMPOS
       ===================================================== */

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


    /* =====================================================
       MENSAGENS
       ===================================================== */

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


    /* =====================================================
       BOTÃO PRINCIPAL
       ===================================================== */

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


    /* =====================================================
       TROCA LOGIN / CADASTRO
       ===================================================== */

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

      transition:
        color .2s ease;

    }


    .auth-link:hover {

      color: var(--color-gold-bright);

      text-decoration: underline;

    }


    /* =====================================================
       RESPONSIVIDADE
       ===================================================== */

    @media (max-width: 480px) {

      .auth-view {

        padding: 18px;

        align-items: flex-start;

        padding-top: 8vh;

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


  container.appendChild(style);


  // =======================================================
  // HTML
  // =======================================================

  container.insertAdjacentHTML(
    "beforeend",
    `

      <div class="auth-container">

        <!-- ===============================================
             MARCA
             =============================================== -->

        <div class="auth-brand">

          <div class="auth-brand-mark">

            <svg
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path
                d="M6 4h12v16H6z"
              />

              <path
                d="M9 7h6M9 11h6M9 15h4"
              />

            </svg>

          </div>


          <h1>
            A <span>Role</span> Play
          </h1>


          <p>
            Entre no seu mundo.
          </p>

        </div>


        <!-- ===============================================
             LOGIN
             =============================================== -->

        <section
          class="auth-form"
          id="login-form-container"
        >

          <div class="auth-form-header">

            <h2>Entrar</h2>

            <p>
              Acesse suas mesas e continue sua aventura.
            </p>

          </div>


          <form id="login-form">

            <div class="form-field">

              <label for="login-email">
                E-mail
              </label>

              <input
                id="login-email"
                name="email"
                type="email"
                autocomplete="email"
                placeholder="seu@email.com"
                required
              >

            </div>


            <div class="form-field">

              <label for="login-password">
                Senha
              </label>

              <input
                id="login-password"
                name="password"
                type="password"
                autocomplete="current-password"
                placeholder="Sua senha"
                required
              >

            </div>


            <div
              class="auth-message"
              id="login-message"
              aria-live="polite"
            ></div>


            <button
              type="submit"
              class="auth-submit"
              id="login-submit"
            >
              Entrar
            </button>

          </form>


          <div class="auth-switch">

            <span>
              Ainda não possui uma conta?
            </span>

            <button
              type="button"
              class="auth-link"
              id="show-register"
            >
              Criar conta
            </button>

          </div>

        </section>


        <!-- ===============================================
             CADASTRO
             =============================================== -->

        <section
          class="auth-form"
          id="register-form-container"
          hidden
        >

          <div class="auth-form-header">

            <h2>Criar conta</h2>

            <p>
              Crie seu perfil e comece sua aventura.
            </p>

          </div>


          <form id="register-form">

            <div class="form-field">

              <label for="register-username">
                Nome de usuário
              </label>

              <input
                id="register-username"
                name="username"
                type="text"
                autocomplete="username"
                placeholder="Como você será conhecido?"
                minlength="3"
                maxlength="30"
                required
              >

            </div>


            <div class="form-field">

              <label for="register-email">
                E-mail
              </label>

              <input
                id="register-email"
                name="email"
                type="email"
                autocomplete="email"
                placeholder="seu@email.com"
                required
              >

            </div>


            <div class="form-field">

              <label for="register-password">
                Senha
              </label>

              <input
                id="register-password"
                name="password"
                type="password"
                autocomplete="new-password"
                placeholder="Crie uma senha"
                minlength="6"
                required
              >

            </div>


            <div
              class="auth-message"
              id="register-message"
              aria-live="polite"
            ></div>


            <button
              type="submit"
              class="auth-submit"
              id="register-submit"
            >
              Criar conta
            </button>

          </form>


          <div class="auth-switch">

            <span>
              Já possui uma conta?
            </span>

            <button
              type="button"
              class="auth-link"
              id="show-login"
            >
              Voltar para login
            </button>

          </div>

        </section>

      </div>

    `
  );


  // =======================================================
  // ELEMENTOS
  // =======================================================

  const loginContainer =
    container.querySelector(
      "#login-form-container"
    );

  const registerContainer =
    container.querySelector(
      "#register-form-container"
    );

  const showRegister =
    container.querySelector(
      "#show-register"
    );

  const showLogin =
    container.querySelector(
      "#show-login"
    );


  // =======================================================
  // LOGIN → CADASTRO
  // =======================================================

  showRegister.addEventListener(
    "click",
    () => {

      loginContainer.hidden = true;
      registerContainer.hidden = false;

      clearMessages(container);

      const username =
        container.querySelector(
          "#register-username"
        );

      username.focus();

    }
  );


  // =======================================================
  // CADASTRO → LOGIN
  // =======================================================

  showLogin.addEventListener(
    "click",
    () => {

      registerContainer.hidden = true;
      loginContainer.hidden = false;

      clearMessages(container);

      const email =
        container.querySelector(
          "#login-email"
        );

      email.focus();

    }
  );


  // =======================================================
  // LOGIN
  // =======================================================

  const loginForm =
    container.querySelector(
      "#login-form"
    );

  loginForm.addEventListener(
    "submit",
    async event => {

      event.preventDefault();

      clearMessages(container);

      const email =
        loginForm.email.value.trim();

      const password =
        loginForm.password.value;


      if (!email || !password) {

        showMessage(
          container,
          "login",
          "Preencha todos os campos."
        );

        return;

      }


      const submitButton =
        container.querySelector(
          "#login-submit"
        );


      setLoading(
        submitButton,
        true,
        "Entrando..."
      );


      try {

        await signInWithEmailAndPassword(
          auth,
          email,
          password
        );


        window.router.navigate(
          "/home"
        );


      } catch (error) {

        console.error(
          "Erro ao fazer login:",
          error
        );


        showMessage(
          container,
          "login",
          translateAuthError(error)
        );


      } finally {

        setLoading(
          submitButton,
          false,
          "Entrar"
        );

      }

    }
  );


  // =======================================================
  // CADASTRO
  // =======================================================

  const registerForm =
    container.querySelector(
      "#register-form"
    );


  registerForm.addEventListener(
    "submit",
    async event => {

      event.preventDefault();

      clearMessages(container);


      const username =
        registerForm.username.value.trim();

      const email =
        registerForm.email.value.trim();

      const password =
        registerForm.password.value;


      // ---------------------------------------------------
      // VALIDAÇÕES
      // ---------------------------------------------------

      if (
        !username ||
        !email ||
        !password
      ) {

        showMessage(
          container,
          "register",
          "Preencha todos os campos."
        );

        return;

      }


      if (username.length < 3) {

        showMessage(
          container,
          "register",
          "O nome de usuário precisa ter pelo menos 3 caracteres."
        );

        return;

      }


      if (username.length > 30) {

        showMessage(
          container,
          "register",
          "O nome de usuário pode ter no máximo 30 caracteres."
        );

        return;

      }


      if (password.length < 6) {

        showMessage(
          container,
          "register",
          "A senha precisa ter pelo menos 6 caracteres."
        );

        return;

      }


      const submitButton =
        container.querySelector(
          "#register-submit"
        );


      setLoading(
        submitButton,
        true,
        "Criando..."
      );


      try {

        // -------------------------------------------------
        // CRIA USUÁRIO
        // -------------------------------------------------

        const userCredential =
          await createUserWithEmailAndPassword(
            auth,
            email,
            password
          );


        const user =
          userCredential.user;


        // -------------------------------------------------
        // DISPLAY NAME
        // -------------------------------------------------

        await updateProfile(
          user,
          {
            displayName: username
          }
        );


        // -------------------------------------------------
        // PERFIL FIRESTORE
        // -------------------------------------------------

        await setDoc(
          doc(
            db,
            "users",
            user.uid
          ),
          {

            uid: user.uid,

            username: username,

            email: email,

            photoURL: null,

            friends: [],

            createdAt:
              serverTimestamp()

          }
        );


        // -------------------------------------------------
        // HOME
        // -------------------------------------------------

        window.router.navigate(
          "/home"
        );


      } catch (error) {

        console.error(
          "Erro ao criar conta:",
          error
        );


        showMessage(
          container,
          "register",
          translateAuthError(error)
        );


      } finally {

        setLoading(
          submitButton,
          false,
          "Criar conta"
        );

      }

    }
  );


  // =======================================================
  // RETORNA VIEW
  // =======================================================

  return container;

}


// =========================================================
// MENSAGENS
// =========================================================

function showMessage(
  container,
  type,
  message
) {

  const element =
    container.querySelector(
      `#${type}-message`
    );

  if (!element) return;

  element.textContent = message;

}


// =========================================================
// LIMPAR MENSAGENS
// =========================================================

function clearMessages(container) {

  const messages =
    container.querySelectorAll(
      ".auth-message"
    );


  messages.forEach(
    message => {

      message.textContent = "";

    }
  );

}


// =========================================================
// LOADING
// =========================================================

function setLoading(
  button,
  loading,
  text
) {

  button.disabled = loading;

  button.textContent = text;

}


// =========================================================
// ERROS FIREBASE
// =========================================================

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