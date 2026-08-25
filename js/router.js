// =========================================================
// ROUTER PRINCIPAL — A ROLE PLAY
// =========================================================

import { auth } from "./firebase-config.js";

import {
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";


// =========================================================
// APP
// =========================================================

const app = document.getElementById("app");


// =========================================================
// VIEWS
// =========================================================

const views = {

  auth: () =>
    import("./views/auth.js"),

  home: () =>
    import("./views/home.js"),

  createTable: () =>
    import("./views/create-table.js"),

  characterSheet: () =>
    import("./views/character-sheet.js"),

  game: () =>
    import("./views/game.js"),

  editTable: () =>
    import("./views/edit-table.js"),

  profile: () =>
    import("./views/profile.js")

};


// =========================================================
// ESTADO DO ROUTER
// =========================================================

let currentRoute = null;

let authReady = false;

let currentUser = null;


// =========================================================
// PROMISE DE AUTENTICAÇÃO
//
// O Firebase precisa de alguns instantes para descobrir
// se existe uma sessão persistente.
//
// O router espera isso antes de decidir qual tela abrir.
// =========================================================

const authReadyPromise =
  new Promise(resolve => {

    onAuthStateChanged(
      auth,
      user => {

        currentUser = user;

        authReady = true;

        resolve(user);

      }
    );

  });


// =========================================================
// LIMPA A VIEW ATUAL
// =========================================================

function clearApp() {

  app.innerHTML = "";

}


// =========================================================
// RENDERIZA UMA VIEW
// =========================================================

async function render(
  viewName,
  params = {}
) {

  const loader =
    views[viewName];


  if (!loader) {

    console.error(
      `View não encontrada: ${viewName}`
    );

    return navigate("/home");

  }


  try {

    clearApp();


    const module =
      await loader();


    /*
     * Toda View deve exportar:
     *
     * export function render(params) {
     *
     * }
     *
     * ou:
     *
     * export default function render(params) {
     *
     * }
     */

    const renderView =
      module.render ||
      module.default;


    if (
      typeof renderView !== "function"
    ) {

      throw new Error(
        `A view "${viewName}" não possui uma função render().`
      );

    }


    /*
     * A View pode retornar:
     *
     * - HTMLElement
     * - DocumentFragment
     * - HTML string
     * - null
     */

    const content =
      await renderView(params);


    if (
      typeof content === "string"
    ) {

      app.innerHTML =
        content;

    }

    else if (
      content instanceof Node
    ) {

      app.appendChild(
        content
      );

    }

    else if (
      content != null
    ) {

      console.warn(
        `A view "${viewName}" retornou um tipo inesperado.`,
        content
      );

    }


    currentRoute = {

      view: viewName,

      params

    };


    window.scrollTo(
      0,
      0
    );


  } catch (error) {

    console.error(
      `Erro ao carregar a view "${viewName}":`,
      error
    );


    app.innerHTML = `

      <div
        style="
          min-height:100dvh;
          display:flex;
          align-items:center;
          justify-content:center;
          padding:30px;
          text-align:center;
          color:var(--text-primary);
        "
      >

        <div>

          <h1>
            Erro
          </h1>

          <p>
            Não foi possível carregar esta tela.
          </p>

        </div>

      </div>

    `;

  }

}


// =========================================================
// INTERPRETA A ROTA
// =========================================================
//
// Agora usamos pathname normalmente:
//
// /auth
// /home
// /create-table
// /profile
//
// etc.
//
// Também aceitamos URLs antigas para facilitar a migração.
// =========================================================

function resolveRoute() {

  let path =
    window.location.pathname;


  /*
   * Remove barras duplicadas.
   */

  path =
    path.replace(
      /\/+/g,
      "/"
    );


  /*
   * Remove "/" final,
   * exceto quando estamos na raiz.
   */

  if (
    path.length > 1 &&
    path.endsWith("/")
  ) {

    path =
      path.slice(
        0,
        -1
      );

  }


  // =======================================================
  // AUTH
  // =======================================================

  if (

    path === "/" ||

    path === "/auth" ||

    path === "/login" ||

    path === "/cadastro"

  ) {

    return {

      view: "auth",

      params: {}

    };

  }


  // =======================================================
  // HOME
  // =======================================================

  if (
    path === "/home"
  ) {

    return {

      view: "home",

      params: {}

    };

  }


  // =======================================================
  // CRIAR MESA
  // =======================================================

  if (

    path === "/create-table" ||

    path === "/table/create"

  ) {

    return {

      view: "createTable",

      params: {}

    };

  }


  // =======================================================
  // FICHA DO PERSONAGEM
  //
  // /character-sheet/ABC123
  //
  // Compatibilidade:
  //
  // /table/ABC123/sheet
  // =======================================================

  let match =
    path.match(
      /^\/character-sheet\/([^/]+)$/
    );


  if (match) {

    return {

      view: "characterSheet",

      params: {

        tableId:
          decodeURIComponent(
            match[1]
          )

      }

    };

  }


  match =
    path.match(
      /^\/table\/([^/]+)\/sheet$/
    );


  if (match) {

    return {

      view: "characterSheet",

      params: {

        tableId:
          decodeURIComponent(
            match[1]
          )

      }

    };

  }


  // =======================================================
  // EDITAR MESA
  // /edit-table/ABC123
  // Compatibilidade: /table/ABC123/edit
  // =======================================================

  match =
    path.match(
      /^\/edit-table\/([^/]+)$/
    );

  if (match) {
    return {
      view: "editTable",
      params: {
        tableId: decodeURIComponent(match[1])
      }
    };
  }

  match =
    path.match(
      /^\/table\/([^/]+)\/edit$/
    );

  if (match) {
    return {
      view: "editTable",
      params: {
        tableId: decodeURIComponent(match[1])
      }
    };
  }


  // =======================================================
  // ROLEPLAY
  // /roleplay/ABC123
  // =======================================================

  match =
    path.match(
      /^\/roleplay\/([^/]+)$/
    );

  if (match) {
    return {
      view: "game",
      params: {
        tableId:
          decodeURIComponent(
            match[1]
          )
      }
    };
  }


  // =======================================================
  // JOGO
  //
  // /game/ABC123
  //
  // Compatibilidade:
  //
  // /table/ABC123/game
  // =======================================================

  match =
    path.match(
      /^\/game\/([^/]+)$/
    );


  if (match) {

    return {

      view: "game",

      params: {

        tableId:
          decodeURIComponent(
            match[1]
          )

      }

    };

  }


  match =
    path.match(
      /^\/table\/([^/]+)\/game$/
    );


  if (match) {

    return {

      view: "game",

      params: {

        tableId:
          decodeURIComponent(
            match[1]
          )

      }

    };

  }


  // =======================================================
  // PERFIL
  // =======================================================

  if (
    path === "/profile"
  ) {

    return {

      view: "profile",

      params: {}

    };

  }


  // =======================================================
  // ROTA DESCONHECIDA
  // =======================================================

  return {

    view:
      currentUser
        ? "home"
        : "auth",

    params: {}

  };

}


// =========================================================
// PROTEÇÃO DE ROTAS
// =========================================================

function isPublicRoute(
  viewName
) {

  return viewName === "auth";

}


// =========================================================
// NAVEGAÇÃO
// =========================================================

export function navigate(
  path
) {

  if (
    !path ||
    typeof path !== "string"
  ) {

    return;

  }


  /*
   * Aceita tanto:
   *
   * /home
   *
   * quanto:
   *
   * #/home
   *
   * caso alguma View antiga ainda utilize hash.
   */

  if (
    path.startsWith("#")
  ) {

    path =
      path.substring(1);

  }


  /*
   * Garante que a rota comece com "/".
   */

  if (
    !path.startsWith("/")
  ) {

    path =
      "/" + path;

  }


  /*
   * Evita reload completo.
   */

  if (
    window.location.pathname !== path
  ) {

    window.history.pushState(
      {},
      "",
      path
    );

  }


  loadRoute();

}


// =========================================================
// CARREGA A ROTA ATUAL
// =========================================================

async function loadRoute() {

  /*
   * MUITO IMPORTANTE:
   *
   * Esperamos o Firebase terminar de recuperar
   * a sessão persistente.
   */

  await authReadyPromise;


  const route =
    resolveRoute();


  // =======================================================
  // USUÁRIO NÃO AUTENTICADO
  // =======================================================

  if (

    !currentUser &&

    !isPublicRoute(
      route.view
    )

  ) {

    if (
      window.location.pathname !==
      "/auth"
    ) {

      window.history.replaceState(
        {},
        "",
        "/auth"
      );

    }


    await render(
      "auth",
      {}
    );

    return;

  }


  // =======================================================
  // USUÁRIO AUTENTICADO
  // =======================================================

  if (

    currentUser &&

    route.view === "auth"

  ) {

    if (
      window.location.pathname !==
      "/home"
    ) {

      window.history.replaceState(
        {},
        "",
        "/home"
      );

    }


    await render(
      "home",
      {}
    );

    return;

  }


  // =======================================================
  // RENDERIZA A ROTA
  // =======================================================

  await render(
    route.view,
    route.params
  );

}


// =========================================================
// BOTÃO VOLTAR / AVANÇAR
// =========================================================

window.addEventListener(
  "popstate",
  () => {

    loadRoute();

  }
);


// =========================================================
// LINKS INTERNOS
//
// <a href="/home">
// <a href="/profile">
// etc.
// =========================================================

document.addEventListener(
  "click",
  event => {

    const link =
      event.target.closest(
        "a[href]"
      );


    if (!link) {
      return;
    }


    /*
     * Não intercepta:
     *
     * Ctrl + clique
     * Cmd + clique
     * Shift + clique
     * Alt + clique
     */

    if (

      event.ctrlKey ||
      event.metaKey ||
      event.shiftKey ||
      event.altKey

    ) {

      return;

    }


    const url =
      new URL(
        link.href,
        window.location.origin
      );


    /*
     * Só links internos.
     */

    if (
      url.origin !==
      window.location.origin
    ) {

      return;

    }


    event.preventDefault();


    navigate(
      url.pathname
    );

  }
);


// =========================================================
// OBSERVADOR DE AUTENTICAÇÃO
// =========================================================
//
// Isso mantém o aplicativo sincronizado caso:
// - usuário faça login
// - usuário faça cadastro
// - usuário saia
// - sessão seja restaurada
// =========================================================

let isInitialAuthChange = true;

onAuthStateChanged(
  auth,
  async user => {

    /*
     * O primeiro disparo já foi utilizado
     * pelo authReadyPromise e loadRoute().
     *
     * Aqui ignoramos a execução inicial e cuidamos apenas
     * das mudanças posteriores de estado.
     */

    if (isInitialAuthChange) {
      isInitialAuthChange = false;
      return;
    }


    const previousUser =
      currentUser;


    currentUser =
      user;


    /*
     * Se o usuário acabou de sair,
     * manda para autenticação.
     */

    if (
      !user
    ) {

      const currentPath =
        window.location.pathname;


      if (
        currentPath !== "/auth"
      ) {

        window.history.replaceState(
          {},
          "",
          "/auth"
        );

      }


      await render(
        "auth",
        {}
      );


      return;

    }


    /*
     * Se acabou de entrar,
     * vai para Home quando estiver na
     * tela de autenticação.
     */

    if (

      user &&

      (
        !previousUser ||

        window.location.pathname ===
        "/auth" ||

        window.location.pathname ===
        "/login" ||

        window.location.pathname ===
        "/cadastro" ||

        window.location.pathname === "/"

      )

    ) {

      window.history.replaceState(
        {},
        "",
        "/home"
      );


      await render(
        "home",
        {}
      );

    }

  }
);


// =========================================================
// API GLOBAL
// =========================================================

window.router = {

  navigate,

  loadRoute,

  getCurrentRoute:
    () => currentRoute,

  getCurrentUser:
    () => currentUser

};


// =========================================================
// INICIALIZAÇÃO
// =========================================================
//
// NÃO fazemos simplesmente:
//
// loadRoute();
//
// porque precisamos garantir que o Firebase tenha
// terminado de restaurar a sessão primeiro.
// =========================================================

loadRoute();
