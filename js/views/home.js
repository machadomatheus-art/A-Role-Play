// =========================================================
// HOME VIEW
// Lista de mesas do usuário
// =========================================================

import { auth, db } from "../firebase-config.js";

import {
  collection,
  query,
  where,
  onSnapshot,
  doc,
  getDoc
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";


// =========================================================
// RENDER
// =========================================================

export function render() {

  const container = document.createElement("div");

  container.className = "home-view";


  // =======================================================
  // USUÁRIO
  // =======================================================

  const user = auth.currentUser;


  if (!user) {

    navigate("/auth");

    return container;

  }


  // =======================================================
  // HTML
  // =======================================================

  container.innerHTML = `

    <style>

      /* ====================================================
         HOME
         ==================================================== */

      .home-screen {

        width: 100%;
        height: 100dvh;

        display: flex;
        flex-direction: column;

        overflow: hidden;

        background: var(--bg-primary);
        color: var(--text-primary);

      }


      /* ====================================================
         TOPO
         ==================================================== */

      .home-header {

        flex-shrink: 0;

        min-height: 62px;

        display: flex;
        align-items: center;

        padding: 0 18px;

        background:
          linear-gradient(
            180deg,
            var(--bg-secondary),
            var(--bg-primary)
          );

        border-bottom:
          1px solid var(--border-color);

      }


      .home-profile-button {

        appearance: none;

        border: 0;

        background: transparent;

        color: var(--text-primary);

        padding: 9px 8px;

        margin: 0;

        font-size: 1.08rem;
        font-weight: 700;

        cursor: pointer;

        text-align: left;

        border-radius: 10px;

        transition:
          background-color .2s ease,
          color .2s ease,
          transform .15s ease;

      }


      .home-profile-button:hover {

        background:
          var(--bg-surface);

        color:
          var(--accent-secondary);

      }


      .home-profile-button:active {

        transform:
          scale(.97);

      }


      /* ====================================================
         PESQUISA
         ==================================================== */

      .home-search-wrapper {

        flex-shrink: 0;

        padding: 9px 12px;

        background:
          var(--bg-primary);

        border-bottom:
          1px solid var(--border-color);

      }


      .home-search {

        position: relative;

        width: 100%;
        height: 43px;

        display: flex;
        align-items: center;

        background:
          var(--bg-surface);

        border:
          1px solid var(--border-color);

        border-radius: 22px;

        transition:
          border-color .2s ease,
          box-shadow .2s ease;

      }


      .home-search:focus-within {

        border-color:
          var(--accent-secondary);

        box-shadow:
          0 0 0 3px
          rgba(178, 138, 62, .12);

      }


      .home-search-icon {

        width: 19px;
        height: 19px;

        flex-shrink: 0;

        margin-left: 15px;

        color:
          var(--text-secondary);

      }


      .home-search input {

        flex: 1;

        min-width: 0;

        height: 100%;

        padding:
          0 12px;

        border: 0;

        outline: 0;

        background: transparent;

        color:
          var(--text-primary);

        font-size:
          .94rem;

      }


      .home-search input::placeholder {

        color:
          var(--text-muted);

      }


      .home-search-clear {

        width: 30px;
        height: 30px;

        margin-right: 6px;

        padding: 0;

        border: 0;

        border-radius: 50%;

        background:
          transparent;

        color:
          var(--text-secondary);

        font-size:
          1.3rem;

        line-height: 1;

        cursor: pointer;

        display: flex;

        align-items: center;
        justify-content: center;

      }


      .home-search-clear:hover {

        background:
          var(--bg-surface-light);

        color:
          var(--text-primary);

      }


      /* ====================================================
         LISTA
         ==================================================== */

      .tables-list {

        flex: 1;

        min-height: 0;

        width: 100%;

        overflow-y: auto;

        overflow-x: hidden;

        padding:
          0 0 100px;

        scrollbar-width: thin;

        scrollbar-color:
          var(--border-color)
          transparent;

      }


      .tables-list::-webkit-scrollbar {

        width: 5px;

      }


      .tables-list::-webkit-scrollbar-track {

        background:
          transparent;

      }


      .tables-list::-webkit-scrollbar-thumb {

        background:
          var(--border-color);

        border-radius:
          10px;

      }


      /* ====================================================
         CARD
         ==================================================== */

      .table-card {

        position: relative;

        width: 100%;

        min-height: 78px;

        display: flex;
        align-items: center;

        padding:
          8px 14px 8px 13px;

        background:
          var(--bg-primary);

        border: 0;

        border-bottom:
          1px solid var(--border-color);

        border-left:
          4px solid transparent;

        cursor: pointer;

        transition:
          background-color .15s ease,
          transform .1s ease;

      }


      .table-card:hover {

        background:
          var(--bg-secondary);

      }


      .table-card:active {

        background:
          var(--bg-surface);

      }


      /* MESTRE */

      .table-card.table-master {

        border-left-color:
          var(--accent-primary);

      }


      /* PLAYER */

      .table-card.table-player {

        border-left-color:
          var(--accent-brown);

      }


      /* ====================================================
         AVATAR
         ==================================================== */

      .table-avatar {

        width: 52px;
        height: 52px;

        flex-shrink: 0;

        margin-right: 13px;

        border-radius: 50%;

        display: flex;

        align-items: center;
        justify-content: center;

        background:
          var(--bg-surface);

        color:
          var(--accent-brown);

        border:
          1px solid var(--border-color);

      }


      .table-master .table-avatar {

        color:
          var(--accent-primary);

      }


      .table-avatar svg {

        width: 31px;
        height: 31px;

      }


      /* ====================================================
         CONTEÚDO
         ==================================================== */

      .table-card-content {

        min-width: 0;

        flex: 1;

      }


      .table-card-top,
      .table-card-bottom {

        width: 100%;

        display: flex;

        align-items: center;

        justify-content:
          space-between;

      }


      .table-card-top {

        margin-bottom:
          5px;

      }


      .table-card-top h3 {

        min-width: 0;

        margin: 0;
        padding: 0;

        color:
          var(--text-primary);

        font-size:
          1rem;

        font-weight:
          650;

        white-space:
          nowrap;

        overflow:
          hidden;

        text-overflow:
          ellipsis;

      }


      .table-card-top time {

        flex-shrink: 0;

        margin-left:
          10px;

        color:
          var(--text-muted);

        font-size:
          .72rem;

        white-space:
          nowrap;

      }


      .table-card-bottom {

        min-height:
          19px;

      }


      .table-last-message {

        min-width: 0;

        margin: 0;
        padding: 0;

        color:
          var(--text-secondary);

        font-size:
          .82rem;

        white-space:
          nowrap;

        overflow:
          hidden;

        text-overflow:
          ellipsis;

      }


      .table-role {

        font-style:
          italic;

        opacity:
          .85;

      }


      /* ====================================================
         NÃO LIDAS
         ==================================================== */

      .table-unread {

        min-width:
          20px;

        height:
          20px;

        padding:
          0 5px;

        margin-left:
          8px;

        flex-shrink: 0;

        display:
          inline-flex;

        align-items:
          center;

        justify-content:
          center;

        border-radius:
          50%;

        background:
          var(--accent-primary);

        color:
          var(--text-on-accent);

        font-size:
          .68rem;

        font-weight:
          800;

      }


      /* ====================================================
         FAB
         ==================================================== */

      .create-table-fab {

        position:
          fixed;

        z-index:
          50;

        right:
          20px;

        bottom:
          20px;

        width:
          58px;

        height:
          58px;

        padding:
          0;

        border:
          0;

        border-radius:
          50%;

        display:
          flex;

        align-items:
          center;

        justify-content:
          center;

        background:
          var(--accent-primary);

        color:
          var(--text-on-accent);

        box-shadow:
          var(--shadow-fab);

        cursor:
          pointer;

        transition:
          transform .15s ease,
          background-color .2s ease,
          box-shadow .2s ease;

      }


      .create-table-fab:hover {

        background:
          var(--accent-primary-light);

        transform:
          translateY(-2px);

        box-shadow:
          var(--shadow-fab-hover);

      }


      .create-table-fab:active {

        transform:
          scale(.94);

      }


      .create-table-fab svg {

        width:
          31px;

        height:
          31px;

      }


      /* ====================================================
         LOADING
         ==================================================== */

      .home-loading {

        min-height:
          180px;

        display:
          flex;

        flex-direction:
          column;

        align-items:
          center;

        justify-content:
          center;

        gap:
          12px;

        color:
          var(--text-secondary);

        font-size:
          .85rem;

      }


      .home-loading-spinner {

        width:
          28px;

        height:
          28px;

        border-radius:
          50%;

        border:
          3px solid
          var(--border-color);

        border-top-color:
          var(--accent-secondary);

        animation:
          home-spin .8s linear infinite;

      }


      @keyframes home-spin {

        to {

          transform:
            rotate(360deg);

        }

      }


      /* ====================================================
         VAZIO
         ==================================================== */

      .home-empty {

        min-height:
          60vh;

        padding:
          40px 28px;

        display:
          flex;

        flex-direction:
          column;

        align-items:
          center;

        justify-content:
          center;

        text-align:
          center;

      }


      .home-empty-icon {

        width:
          82px;

        height:
          82px;

        margin-bottom:
          20px;

        display:
          flex;

        align-items:
          center;

        justify-content:
          center;

        color:
          var(--accent-secondary);

        opacity:
          .8;

      }


      .home-empty-icon svg {

        width:
          70px;

        height:
          70px;

      }


      .home-empty h2 {

        margin:
          0 0 8px;

        padding:
          0;

        border:
          0;

        color:
          var(--text-primary);

        font-size:
          1.15rem;

      }


      .home-empty p {

        max-width:
          330px;

        margin:
          0;

        color:
          var(--text-secondary);

        font-size:
          .86rem;

        line-height:
          1.6;

      }


      /* ====================================================
         ERRO
         ==================================================== */

      .home-error {

        min-height:
          50vh;

        padding:
          40px 25px;

        display:
          flex;

        flex-direction:
          column;

        align-items:
          center;

        justify-content:
          center;

        text-align:
          center;

      }


      .home-error-icon {

        width:
          54px;

        height:
          54px;

        margin-bottom:
          16px;

        border:
          2px solid
          var(--accent-primary);

        border-radius:
          50%;

        display:
          flex;

        align-items:
          center;

        justify-content:
          center;

        color:
          var(--accent-primary);

        font-size:
          1.5rem;

        font-weight:
          800;

      }


      .home-error h2 {

        margin:
          0 0 8px;

        padding:
          0;

        border:
          0;

        color:
          var(--text-primary);

        font-size:
          1rem;

      }


      .home-error p {

        margin:
          0;

        color:
          var(--text-secondary);

        font-size:
          .84rem;

      }


      /* ====================================================
         RESPONSIVIDADE
         ==================================================== */

      @media (min-width: 700px) {

        .home-screen {

          max-width:
            760px;

          margin:
            0 auto;

          border-left:
            1px solid var(--border-color);

          border-right:
            1px solid var(--border-color);

        }


        .create-table-fab {

          position:
            absolute;

        }

      }


      @media (max-width: 380px) {

        .home-header {

          min-height:
            56px;

          padding:
            0 14px;

        }


        .home-profile-button {

          font-size:
            1rem;

        }


        .table-card {

          min-height:
            70px;

          padding-left:
            10px;

        }


        .table-avatar {

          width:
            47px;

          height:
            47px;

          margin-right:
            10px;

        }


        .table-avatar svg {

          width:
            27px;

          height:
            27px;

        }


        .create-table-fab {

          width:
            54px;

          height:
            54px;

          right:
            16px;

          bottom:
            16px;

        }

      }

    </style>


    <div class="home-screen">


      <!-- ==================================================
           TOPO
           ================================================== -->

      <header class="home-header">

        <button
          class="home-profile-button"
          id="home-profile-button"
          type="button"
        >

          <span id="home-username">
            Carregando...
          </span>

        </button>

      </header>


      <!-- ==================================================
           PESQUISA
           ================================================== -->

      <div class="home-search-wrapper">

        <div class="home-search">

          <svg
            class="home-search-icon"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          >

            <circle
              cx="11"
              cy="11"
              r="7"
            />

            <path
              d="M20 20l-4-4"
            />

          </svg>


          <input
            id="table-search"
            type="text"
            placeholder="Pesquisar mesas"
            autocomplete="off"
          />


          <button
            id="clear-table-search"
            class="home-search-clear"
            type="button"
            aria-label="Limpar pesquisa"
            hidden
          >
            ×
          </button>

        </div>

      </div>


      <!-- ==================================================
           MESAS
           ================================================== -->

      <main
        id="tables-list"
        class="tables-list"
      >

        <div class="home-loading">

          <div class="home-loading-spinner"></div>

          <span>
            Carregando mesas...
          </span>

        </div>

      </main>


      <!-- ==================================================
           FAB
           ================================================== -->

      <button
        id="create-table-fab"
        class="create-table-fab"
        type="button"
        aria-label="Criar nova mesa"
        title="Criar nova mesa"
      >

        <svg
          viewBox="0 0 64 64"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >

          <path
            d="M7 16L22 11V51L7 56V16Z"
            stroke="currentColor"
            stroke-width="2.5"
            stroke-linejoin="round"
          />

          <path
            d="M22 11L42 16V56L22 51V11Z"
            stroke="currentColor"
            stroke-width="2.5"
            stroke-linejoin="round"
          />

          <path
            d="M42 16L57 11V51L42 56V16Z"
            stroke="currentColor"
            stroke-width="2.5"
            stroke-linejoin="round"
          />

          <path
            d="M12 28L17 26"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
          />

          <path
            d="M27 22L36 25"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
          />

          <path
            d="M47 31L53 28"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
          />

          <path
            d="M32 31C35 31 37 33.2 37 36C37 40 32 44 32 44C32 44 27 40 27 36C27 33.2 29 31 32 31Z"
            stroke="currentColor"
            stroke-width="2"
            stroke-linejoin="round"
          />

          <circle
            cx="32"
            cy="36"
            r="1.5"
            fill="currentColor"
          />

        </svg>

      </button>

    </div>

  `;


  // =======================================================
  // ELEMENTOS
  // =======================================================

  const usernameElement =
    container.querySelector("#home-username");

  const profileButton =
    container.querySelector("#home-profile-button");

  const searchInput =
    container.querySelector("#table-search");

  const clearSearchButton =
    container.querySelector("#clear-table-search");

  const tablesList =
    container.querySelector("#tables-list");

  const createTableButton =
    container.querySelector("#create-table-fab");


  // =======================================================
  // NAVEGAÇÃO
  // =======================================================

  profileButton.addEventListener(
    "click",
    () => {

      navigate("/profile");

    }
  );


  createTableButton.addEventListener(
    "click",
    () => {

      navigate("/create-table");

    }
  );


  // =======================================================
  // ESTADO
  // =======================================================

  let tables = [];


  // =======================================================
  // RENDER MESAS
  // =======================================================

  function renderTables() {

    const search =
      searchInput.value
        .trim()
        .toLocaleLowerCase("pt-BR");


    const filteredTables =
      tables.filter(
        table => {

          const name =
            String(table.name || "")
              .toLocaleLowerCase("pt-BR");

          return name.includes(search);

        }
      );


    clearSearchButton.hidden =
      search.length === 0;


    // =====================================================
    // NENHUMA MESA
    // =====================================================

    if (filteredTables.length === 0) {

      if (tables.length === 0) {

        tablesList.innerHTML = `

          <div class="home-empty">

            <div class="home-empty-icon">

              <svg
                viewBox="0 0 64 64"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
              >

                <path
                  d="M8 18L22 13L42 18L56 13V50L42 55L22 50L8 55V18Z"
                />

                <path d="M22 13V50"/>
                <path d="M42 18V55"/>

                <path d="M16 31L19 29"/>
                <path d="M29 28L35 30"/>
                <path d="M47 36L51 34"/>

              </svg>

            </div>


            <h2>
              Nenhuma mesa ainda
            </h2>


            <p>
              Crie sua primeira mesa ou aguarde um mestre
              adicionar você a uma aventura.
            </p>

          </div>

        `;

        return;

      }


      // ===================================================
      // PESQUISA SEM RESULTADO
      // ===================================================

      tablesList.innerHTML = `

        <div class="home-empty home-empty-search">

          <div class="home-empty-search-icon">

            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="1.8"
              stroke-linecap="round"
              stroke-linejoin="round"
            >

              <circle
                cx="11"
                cy="11"
                r="7"
              />

              <path
                d="M20 20L16 16"
              />

            </svg>

          </div>


          <h2>
            Nenhuma mesa encontrada
          </h2>


          <p>
            Não encontramos nenhuma mesa com esse nome.
          </p>

        </div>

      `;

      return;

    }


    // =====================================================
    // CARDS
    // =====================================================

    tablesList.innerHTML =
      filteredTables
        .map(createTableCard)
        .join("");


    tablesList
      .querySelectorAll("[data-table-id]")
      .forEach(card => {

        card.addEventListener(
          "click",
          () => {

            const tableId =
              card.dataset.tableId;


            if (!tableId) {
              return;
            }


            navigate(
              `/game/${tableId}`
            );

          }
        );

      });

  }


  // =======================================================
  // CARD
  // =======================================================

  function createTableCard(table) {

    const isMaster =
      (table.ownerId || table.masterUid) === user.uid;


    const roleClass =
      isMaster
        ? "table-master"
        : "table-player";


    const roleLabel =
      isMaster
        ? "Mestre"
        : "Player";


    const lastMessage =
      table.lastMessage || "";


    const lastMessageTime =
      formatMessageTime(
        table.lastMessageAt
      );


    const unread =
      Number(
        table.unreadCounts?.[user.uid] ?? table.unreadCount ?? 0
      );


    return `

      <article
        class="table-card ${roleClass}"
        data-table-id="${escapeHTML(table.id)}"
      >

        <div class="table-avatar">

          <svg
            viewBox="0 0 48 48"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          >

            <path
              d="M7 13L17 9L31 13L41 9V35L31 39L17 35L7 39V13Z"
            />

            <path d="M17 9V35"/>
            <path d="M31 13V39"/>

            <circle
              cx="24"
              cy="23"
              r="4"
            />

            <path d="M24 19V27"/>
            <path d="M20 23H28"/>

          </svg>

        </div>


        <div class="table-card-content">

          <div class="table-card-top">

            <h3>
              ${escapeHTML(
                table.name ||
                "Mesa sem nome"
              )}
            </h3>


            <time>
              ${escapeHTML(
                lastMessageTime
              )}
            </time>

          </div>


          <div class="table-card-bottom">

            <p class="table-last-message">

              ${
                lastMessage

                  ? escapeHTML(
                      lastMessage
                    )

                  : `
                    <span class="table-role">
                      ${roleLabel}
                    </span>
                  `
              }

            </p>


            ${
              unread > 0

                ? `
                  <span class="table-unread">

                    ${
                      unread > 99
                        ? "99+"
                        : unread
                    }

                  </span>
                `

                : ""
            }

          </div>

        </div>

      </article>

    `;

  }


  // =======================================================
  // PESQUISA
  // =======================================================

  searchInput.addEventListener(
    "input",
    renderTables
  );


  clearSearchButton.addEventListener(
    "click",
    () => {

      searchInput.value = "";

      searchInput.focus();

      renderTables();

    }
  );


  // =======================================================
  // PERFIL DO USUÁRIO
  // =======================================================

  async function loadUserProfile() {

    try {

      const userRef =
        doc(
          db,
          "users",
          user.uid
        );


      const snapshot =
        await getDoc(userRef);


      if (snapshot.exists()) {

        const data =
          snapshot.data();


        usernameElement.textContent =
          data.username ||
          user.displayName ||
          "Jogador";

      } else {

        usernameElement.textContent =
          user.displayName ||
          "Jogador";

      }

    } catch (error) {

      console.error(
        "Erro ao carregar perfil:",
        error
      );


      usernameElement.textContent =
        user.displayName ||
        "Jogador";

    }

  }


  // =======================================================
  // MESAS
  // =======================================================

  function subscribeToTables() {

    const tablesQuery =
      query(
        collection(db, "tables"),
        where(
          "members",
          "array-contains",
          user.uid
        )
      );


    return onSnapshot(

      tablesQuery,

      snapshot => {

        tables =
          snapshot.docs.map(
            document => ({

              id: document.id,

              ...document.data()

            })
          );


        tables.sort(
          (a, b) => {

            const timeA =
              getTimestampMillis(
                a.lastMessageAt
              );


            const timeB =
              getTimestampMillis(
                b.lastMessageAt
              );


            return timeB - timeA;

          }
        );


        renderTables();

      },


      error => {

        console.error(
          "Erro ao carregar mesas:",
          error
        );


        tablesList.innerHTML = `

          <div class="home-error">

            <div class="home-error-icon">
              !
            </div>


            <h2>
              Não foi possível carregar suas mesas
            </h2>


            <p>
              Verifique sua conexão e tente novamente.
            </p>

          </div>

        `;

      }

    );

  }


  // =======================================================
  // UTILITÁRIOS
  // =======================================================

  function getTimestampMillis(timestamp) {

    if (!timestamp) {
      return 0;
    }


    if (
      typeof timestamp.toMillis ===
      "function"
    ) {

      return timestamp.toMillis();

    }


    if (
      timestamp instanceof Date
    ) {

      return timestamp.getTime();

    }


    if (
      typeof timestamp === "number"
    ) {

      return timestamp;

    }


    return 0;

  }


  function formatMessageTime(timestamp) {

    const millis =
      getTimestampMillis(timestamp);


    if (!millis) {
      return "";
    }


    const date =
      new Date(millis);


    const now =
      new Date();


    if (
      date.toDateString() ===
      now.toDateString()
    ) {

      return date.toLocaleTimeString(
        "pt-BR",
        {
          hour: "2-digit",
          minute: "2-digit"
        }
      );

    }


    const yesterday =
      new Date(now);


    yesterday.setDate(
      now.getDate() - 1
    );


    if (
      date.toDateString() ===
      yesterday.toDateString()
    ) {

      return "Ontem";

    }


    return date.toLocaleDateString(
      "pt-BR",
      {
        day: "2-digit",
        month: "2-digit"
      }
    );

  }


  function escapeHTML(value) {

    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");

  }


  // =======================================================
  // INICIAR
  // =======================================================

  loadUserProfile();

  subscribeToTables();


  // =======================================================
  // RETORNA VIEW
  // =======================================================

  return container;

}


// =========================================================
// NAVEGAÇÃO
// =========================================================

function navigate(path) {

  if (
    window.router &&
    typeof window.router.navigate === "function"
  ) {

    window.router.navigate(path);

    return;

  }


  // Fallback caso o router ainda não esteja disponível.

  window.location.hash =
    `#${path}`;

}