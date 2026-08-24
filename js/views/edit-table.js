// ============================================================
// js/views/edit-table.js
// ============================================================
// Editor universal de mesas de RPG.
//
// A ideia desta view é permitir que o Mestre monte seu próprio
// sistema utilizando "peças de LEGO":
//
// - Identidade
// - Atributos
// - Recursos
// - Perícias
// - Habilidades
// - Equipamentos
// - Estados
// - Campos personalizados
//// - Dados
// - Amigos
//
// Nada aqui pressupõe D&D, Naruto, Harry Potter, etc.
//
// Toda a configuração criada aqui será salva dentro da mesa
// para que character-sheet.js e roleplay.js possam interpretá-la.
// ============================================================


import {
  doc,
  getDoc,
  updateDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

import {
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

import {
  db,
  auth
} from "../firebase-config.js";


// ============================================================
// SVGs DOS DADOS
// ============================================================

import {
  renderSVG_D2,
  renderSVG_D4,
  renderSVG_D6,
  renderSVG_D8,
  renderSVG_D10,
  renderSVG_D12,
  renderSVG_D20
} from "./common/dice.js";


// ============================================================
// ESTADO DA VIEW
// ============================================================

const state = {
  currentUser: null,

  identity: {
    name: "",
    description: ""
  },

  attributes: [],
  resources: [],
  skills: [],
  abilities: [],
  equipmentSettings: {
    enabled: false,
    financeEnabled: false,
    equipmentTypes: [],
    currencyTypes: [],
    loadSystem: "",
    loadUnit: "",
    slotCount: "",
    maxItemsPerSlot: "",
    weightLimit: "",
    weightUnit: "",
    unitMax: "",
    customEquipmentName: "",
    customEquipmentMax: ""
  },
  states: [],
  customFields: [],

  dice: [],

  saving: false,

  editTableId: null,
  existingMembers: [],
  existingSettings: {},
  existingCreatedAt: null
};


// ============================================================
// CONTROLE DE DROPDOWN
// ============================================================

let activeDropdown = null;


// ============================================================
// UTILITÁRIOS
// ============================================================

function createId(prefix = "item") {
  return `${prefix}_${Date.now()}_${Math.random()
    .toString(36)
    .substring(2, 9)}`;
}


function escapeHTML(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}


function normalizeCode(value = "") {
  return String(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]/g, "")
    .substring(0, 3)
    .toUpperCase();
}


function codeFromName(name = "") {
  return normalizeCode(name);
}


function showMessage(message, type = "info") {

  const existing =
    document.getElementById("create-table-message");

  if (existing) {
    existing.remove();
  }

  const element =
    document.createElement("div");

  element.id =
    "create-table-message";

  element.className =
    `create-table-message ${type}`;

  element.textContent =
    message;

  document.body.appendChild(element);

  setTimeout(() => {
    element.classList.add("visible");
  }, 10);

  setTimeout(() => {

    element.classList.remove("visible");

    setTimeout(() => {

      if (element.isConnected) {
        element.remove();
      }

    }, 300);

  }, 3500);
}


// ============================================================
// SVG DE SETA
// ============================================================

function arrowSVG(direction = "down") {

  const rotation =
    direction === "up"
      ? "rotate(180 12 12)"
      : direction === "left"
        ? "rotate(90 12 12)"
        : direction === "right"
          ? "rotate(-90 12 12)"
          : "";

  return `
    <svg
      class="ui-chevron"
      viewBox="0 0 24 24"
      aria-hidden="true"
      ${rotation ? `transform="${rotation}"` : ""}
    >
      <path
        d="M7 9.5L12 14.5L17 9.5"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
      />
    </svg>
  `;
}


// ============================================================
// HELP
// ============================================================

function createHelpButton(title, text) {

  const button =
    document.createElement("button");

  button.type =
    "button";

  button.className =
    "help-button";

  button.textContent =
    "?";

  button.title =
    title;

  button.addEventListener("click", event => {

    event.preventDefault();
    event.stopPropagation();

    openHelp(title, text);
  });

  return button;
}


function openHelp(title, text) {

  const old =
    document.getElementById("help-modal");

  if (old) {
    old.remove();
  }

  const modal =
    document.createElement("div");

  modal.id =
    "help-modal";

  modal.className =
    "help-modal";

  modal.innerHTML = `
    <div class="help-modal-backdrop"></div>

    <div class="help-modal-card">

      <div class="help-modal-header">

        <h3>
          ${escapeHTML(title)}
        </h3>

        <button
          type="button"
          class="help-modal-close"
          aria-label="Fechar"
        >
          ×
        </button>

      </div>

      <div class="help-modal-content">
        ${text}
      </div>

    </div>
  `;

  document.body.appendChild(modal);

  modal
    .querySelector(".help-modal-close")
    ?.addEventListener(
      "click",
      () => modal.remove()
    );

  modal
    .querySelector(".help-modal-backdrop")
    ?.addEventListener(
      "click",
      () => modal.remove()
    );
}


// ============================================================
// ELEMENTOS DE FORMULÁRIO
// ============================================================



// ============================================================
// AJUDA INDIVIDUAL DOS CAMPOS
// ============================================================
// Cada campo recebe sua própria explicação. O texto é escolhido
// pelo rótulo e, quando necessário, pelo placeholder do campo.
const FIELD_HELP = {
  "Nome da mesa": {
    title: "Nome da mesa",
    text: `<p>É o nome que identifica sua campanha e aparece para os jogadores.</p><p><strong>Exemplo:</strong> "As Cinzas de Valéria" ou "Ordem dos Caçadores".</p>`
  },
  "Descrição": {
    title: "Descrição",
    text: `<p>Explique o que este elemento representa e, quando a descrição participar de uma rolagem, declare os bônus diretamente aqui.</p><p><strong>Modelo visual:</strong></p><p><code>[ATR+valor]</code> &nbsp;→&nbsp; atributo + bônus</p><p><code>[ATR-valor]</code> &nbsp;→&nbsp; atributo − penalidade</p><p><code>[ATR+!]</code> &nbsp;→&nbsp; soma o mesmo valor do atributo na ficha</p><p><code>[ATR+!/2]</code> &nbsp;→&nbsp; soma metade do atributo, arredondada para baixo</p><p><strong>Exemplo:</strong> <code>[FOR+2][DES+!][CON+!/2]</code>.</p><p><strong>Símbolos:</strong> <code>+</code> soma, <code>-</code> subtrai, <code>*</code> multiplica, <code>/</code> divide e <code>!</code> representa o valor do atributo na ficha.</p><p>O código <code>FOR</code>, <code>DES</code>, <code>CON</code> etc. vem do código automático do Atributo criado a partir do nome.</p>`
  },
  "Nome": {
    title: "Nome",
    text: `<p>É o nome que será mostrado na ficha e nas rolagens.</p><p><strong>Exemplos:</strong> Força, Vida, Furtividade, Visão Noturna.</p><p>Escolha um nome claro. O código usado pelo sistema é derivado automaticamente do nome quando aplicável.</p>`
  },
  "Tipo": {
    title: "Tipo",
    text: `<p>Define como este elemento deve ser tratado pelo sistema.</p><p><strong>Exemplos:</strong> Número, Texto, Sim/Não, Percentual ou Barra, conforme o tipo de elemento.</p><p>Em habilidades, este campo é livre: você pode criar categorias como <strong>Passiva</strong>, <strong>Ativa</strong>, <strong>Ritualística</strong>, <strong>Invocática</strong> ou <strong>Evocativa</strong>.</p>`
  },
  "Valor máximo": {
    title: "Valor máximo",
    text: `<p>Digite diretamente o valor máximo ou uma fórmula entre colchetes.</p><p><strong>Exemplo direto:</strong> <code>100</code>.</p><p><strong>Exemplo por atributo:</strong> <code>[FOR*10]</code>.</p><hr><p><strong>Modelo:</strong> <code>[ATR op valor]</code></p><ul><li><code>FOR</code> = código do atributo.</li><li><code>+</code> soma.</li><li><code>-</code> subtrai.</li><li><code>*</code> multiplica.</li><li><code>/</code> divide.</li><li><code>!</code> usa a mesma quantidade do atributo na ficha.</li></ul><p>Se FOR = 6, <code>[FOR*10]</code> resulta em 60.</p>`
  },
  "Máximo": {
    title: "Valor máximo",
    text: `<p>Define o limite permitido para este campo.</p><p><strong>Exemplos:</strong> <code>10</code>, <code>100</code> ou uma fórmula como <code>[FOR*10]</code>, quando o campo aceitar fórmulas.</p>`
  },
  "Custo": {
    title: "Custo",
    text: `<p>Indica quanto o personagem precisa gastar para usar a habilidade.</p><p><strong>Exemplos:</strong> 5 Mana, 10 Energia ou 1 ação.</p>`
  },
  "Sistema de carga": {
    title: "Sistema de carga",
    text: `<p>Define como o inventário controla quanto um personagem pode carregar.</p><p><strong>Livre/Sem limite:</strong> não limita a quantidade carregada.</p><p><strong>Slot:</strong> divide o inventário em espaços.</p><p><strong>Peso:</strong> controla a carga por kg ou lbs.</p><p><strong>Unidade:</strong> usa uma quantidade máxima de unidades.</p><p><strong>Personalizado:</strong> permite criar sua própria unidade de limite.</p>`
  },
  "Unidade": {
    title: "Unidade",
    text: `<p>Define a unidade usada pelo limite deste sistema.</p><p><strong>Exemplos:</strong> kg, lbs, pontos, espaços, cargas ou qualquer unidade que faça sentido para sua mesa.</p>`
  },
  "Variedades de moedas": {
    title: "Variedades de moedas",
    text: `<p>Cadastre os tipos de dinheiro que existirão na campanha.</p><p><strong>Exemplos:</strong> Ouro, Prata, Cobre, Créditos ou Fragmentos.</p>`
  },
  "Variedades de equipamentos": {
    title: "Variedades de equipamentos",
    text: `<p>Crie categorias para organizar os itens da ficha.</p><p><strong>Exemplos:</strong> Arma, Armadura, Consumível, Relíquia, Ferramenta.</p>`
  },
  "Opções": {
    title: "Opções",
    text: `<p>Cadastre as opções que o jogador poderá escolher neste campo.</p><p><strong>Exemplo:</strong> Para um campo "Tamanho", use Pequeno, Médio e Grande.</p>`
  },
  "Limite de peso": {
    title: "Limite de peso",
    text: `<p>Informe o peso máximo que o personagem pode carregar.</p><p>Você pode usar um número, como <code>50</code>, ou uma fórmula, como <code>[FOR*10]</code>.</p><p>Se FOR = 6, o resultado de <code>[FOR*10]</code> será 60.</p>`
  },
  "Quantidade de slots": {
    title: "Quantidade de slots",
    text: `<p>Define quantos espaços de inventário existem.</p><p><strong>Exemplo:</strong> <code>20</code> cria 20 slots.</p>`
  },
  "Máximo de fragmentos por slot": {
    title: "Máximo de fragmentos por slot",
    text: `<p>Define quantos itens do mesmo tipo cabem em um único slot.</p><p>Deixe vazio para permitir quantidade ilimitada por slot.</p><p><strong>Exemplo:</strong> <code>10</code> permite até 10 unidades.</p>`
  },
  "Valor máximo": {
    title: "Valor máximo",
    text: `<p>Digite diretamente o valor máximo ou uma fórmula entre colchetes.</p><p><strong>Exemplos:</strong> <code>100</code> ou <code>[FOR*10]</code>.</p><p><strong>Fórmula:</strong> <code>[ATR op valor]</code>. <code>+</code> soma, <code>-</code> subtrai, <code>*</code> multiplica, <code>/</code> divide e <code>!</code> usa o valor do atributo na ficha.</p>`
  },
  "Expressão": {
    title: "Expressão",
    text: `<p>É a fórmula usada pelo sistema para calcular o resultado.</p><p><strong>Exemplo:</strong> <code>[FOR+2]</code>, <code>[DES+!]</code> ou <code>[CON+!/2]</code>.</p><p><code>!</code> significa a mesma quantidade do atributo correspondente na ficha.</p>`
  },
  "Pesquisar": {
    title: "Pesquisar amigos",
    text: `<p>Digite parte do nome de um amigo para encontrar pessoas que podem ser convidadas para a mesa.</p>`
  }
};

function resolveFieldHelp(label, input) {
  const base = FIELD_HELP[label];
  if (!base) {
    return {
      title: label,
      text: `<p>Este campo configura <strong>${escapeHTML(label)}</strong> nesta mesa.</p><p>Preencha apenas quando quiser alterar o comportamento padrão e use um valor que faça sentido para as regras da sua campanha.</p>`
    };
  }
  return base;
}


function field(label, input, help = null) {

  help = help || resolveFieldHelp(label, input);

  const wrapper =
    document.createElement("div");

  wrapper.className =
    "create-field";

  const labelRow =
    document.createElement("div");

  labelRow.className =
    "create-field-label";

  const labelElement =
    document.createElement("label");

  labelElement.textContent =
    label;

  labelRow.appendChild(labelElement);

  if (help) {

    labelRow.appendChild(
      createHelpButton(
        help.title,
        help.text
      )
    );
  }

  wrapper.appendChild(labelRow);
  wrapper.appendChild(input);

  return wrapper;
}


function textInput(
  value = "",
  placeholder = ""
) {

  const input =
    document.createElement("input");

  input.type =
    "text";

  input.className =
    "builder-input";

  input.value =
    value ?? "";

  input.placeholder =
    placeholder;

  return input;
}


function numberInput(
  value = "",
  placeholder = ""
) {

  const input =
    document.createElement("input");

  input.type =
    "number";

  input.className =
    "builder-input";

  input.value =
    value ?? "";

  input.placeholder =
    placeholder;

  return input;
}


function textarea(
  value = "",
  placeholder = ""
) {

  const input =
    document.createElement("textarea");

  input.className =
    "builder-input builder-textarea";

  input.value =
    value ?? "";

  input.placeholder =
    placeholder;

  input.rows =
    4;

  return input;
}


// ============================================================
// DROPDOWN CUSTOMIZADO
// ============================================================
//
// Não usamos <select>.
//
// O menu é colocado diretamente no body com position: fixed.
// Dessa forma ele não é cortado por:
// - overflow: hidden
// - cards
// - sections
// - containers
//
// ============================================================

function closeActiveDropdown() {

  if (!activeDropdown) {
    return;
  }

  activeDropdown.remove();
  activeDropdown = null;
}


function positionDropdown(menu, trigger) {

  const rect =
    trigger.getBoundingClientRect();

  const viewportPadding =
    8;

  const menuWidth =
    Math.max(
      rect.width,
      190
    );

  menu.style.width =
    `${menuWidth}px`;

  const estimatedHeight =
    Math.min(
      menu.scrollHeight || 260,
      320
    );

  let top =
    rect.bottom + 6;

  let left =
    rect.left;

  if (
    top + estimatedHeight >
    window.innerHeight - viewportPadding
  ) {

    top =
      rect.top -
      estimatedHeight -
      6;
  }

  if (
    top < viewportPadding
  ) {

    top =
      viewportPadding;
  }

  if (
    left + menuWidth >
    window.innerWidth - viewportPadding
  ) {

    left =
      window.innerWidth -
      menuWidth -
      viewportPadding;
  }

  if (
    left < viewportPadding
  ) {

    left =
      viewportPadding;
  }

  menu.style.left =
    `${left}px`;

  menu.style.top =
    `${top}px`;
}


function customSelect(
  options = [],
  selected = ""
) {

  const wrapper =
    document.createElement("div");

  wrapper.className =
    "custom-select";

  wrapper.tabIndex =
    0;

  let currentValue =
    selected ?? "";

  const trigger =
    document.createElement("button");

  trigger.type =
    "button";

  trigger.className =
    "custom-select-trigger";

  const label =
    document.createElement("span");

  label.className =
    "custom-select-label";

  const arrow =
    document.createElement("span");

  arrow.className =
    "custom-select-arrow";

  arrow.innerHTML =
    arrowSVG("down");

  trigger.appendChild(label);
  trigger.appendChild(arrow);

  wrapper.appendChild(trigger);


  function findOption() {

    return options.find(
      option =>
        (
          typeof option === "string"
            ? option
            : option.value
        ) === currentValue
    );
  }


  function updateLabel() {

    const selectedOption =
      findOption();

    label.textContent =
      selectedOption
        ? (
            typeof selectedOption === "string"
              ? selectedOption
              : selectedOption.label
          )
        : (
            options[0]
              ? (
                  typeof options[0] === "string"
                    ? options[0]
                    : options[0].label
                )
              : ""
          );
  }


  updateLabel();


  function openMenu() {

    if (activeDropdown) {
      closeActiveDropdown();
    }

    const menu =
      document.createElement("div");

    menu.className =
      "custom-select-menu";

    menu.setAttribute(
      "role",
      "listbox"
    );

    options.forEach(option => {

      const value =
        typeof option === "string"
          ? option
          : option.value;

      const text =
        typeof option === "string"
          ? option
          : option.label;

      const optionElement =
        document.createElement("button");

      optionElement.type =
        "button";

      optionElement.className =
        "custom-select-option";

      if (value === currentValue) {
        optionElement.classList.add("selected");
      }

      optionElement.textContent =
        text;

      optionElement.addEventListener(
        "click",
        event => {

          event.preventDefault();
          event.stopPropagation();

          currentValue =
            value;

          wrapper.value =
            currentValue;

          updateLabel();

          wrapper.dispatchEvent(
            new Event(
              "change",
              {
                bubbles: true
              }
            )
          );

          closeActiveDropdown();
        }
      );

      menu.appendChild(optionElement);
    });

    document.body.appendChild(menu);

    activeDropdown =
      menu;

    positionDropdown(
      menu,
      trigger
    );
  }


  trigger.addEventListener(
    "click",
    event => {

      event.preventDefault();
      event.stopPropagation();

      if (
        activeDropdown &&
        activeDropdown.isConnected
      ) {
        closeActiveDropdown();
        return;
      }

      openMenu();
    }
  );


  wrapper.addEventListener(
    "keydown",
    event => {

      if (
        event.key === "Enter" ||
        event.key === " "
      ) {

        event.preventDefault();
        trigger.click();
      }

      if (
        event.key === "Escape"
      ) {

        closeActiveDropdown();
      }
    }
  );


  wrapper.addEventListener(
    "click",
    event => {
      event.stopPropagation();
    }
  );


  wrapper.value =
    currentValue;


  wrapper.setValue =
    value => {

      currentValue =
        value ?? "";

      wrapper.value =
        currentValue;

      updateLabel();
    };


  return wrapper;
}


document.addEventListener(
  "click",
  event => {

    if (
      activeDropdown &&
      !event.target.closest(".custom-select-menu") &&
      !event.target.closest(".custom-select-trigger")
    ) {

      closeActiveDropdown();
    }
  }
);


window.addEventListener(
  "resize",
  () => {

    if (
      activeDropdown
    ) {

      const trigger =
        document.querySelector(
          ".custom-select-trigger"
        );

      if (trigger) {
        positionDropdown(
          activeDropdown,
          trigger
        );
      }
    }
  }
);


window.addEventListener(
  "scroll",
  () => {

    if (activeDropdown) {
      closeActiveDropdown();
    }
  },
  true
);


// ============================================================
// CARD EXPANSÍVEL
// ============================================================

function createExpandableCard({
  title,
  subtitle = "",
  icon = "",
  expanded = false,
  onRemove = null
}) {

  const card =
    document.createElement("div");

  card.className =
    "builder-card";

  if (expanded) {
    card.classList.add("expanded");
  }

  const header =
    document.createElement("div");

  header.className =
    "builder-card-header";

  const information =
    document.createElement("div");

  information.className =
    "builder-card-information";

  information.innerHTML = `
    <div class="builder-card-icon">
      ${icon}
    </div>

    <div class="builder-card-text">

      <div class="builder-card-title">
        ${escapeHTML(title || "Novo item")}
      </div>

      ${
        subtitle
          ? `
            <div class="builder-card-subtitle">
              ${escapeHTML(subtitle)}
            </div>
          `
          : ""
      }

    </div>
  `;

  const actions =
    document.createElement("div");

  actions.className =
    "builder-card-actions";

  if (onRemove) {

    const removeButton =
      document.createElement("button");

    removeButton.type =
      "button";

    removeButton.className =
      "builder-remove-button";

    removeButton.title =
      "Remover";

    removeButton.textContent = "×";

    removeButton.addEventListener(
      "click",
      event => {

        event.preventDefault();
        event.stopPropagation();

        onRemove(card);
      }
    );

    actions.appendChild(
      removeButton
    );
  }

  const arrow =
    document.createElement("span");

  arrow.className =
    "builder-card-arrow";

  arrow.innerHTML =
    arrowSVG("down");

  actions.appendChild(
    arrow
  );

  header.appendChild(
    information
  );

  header.appendChild(
    actions
  );

  const body =
    document.createElement("div");

  body.className =
    "builder-card-body";

  header.addEventListener(
    "click",
    event => {

      if (
        event.target.closest(
          ".builder-remove-button"
        )
      ) {
        return;
      }

      card.classList.toggle(
        "expanded"
      );
    }
  );

  card.appendChild(header);
  card.appendChild(body);

  return {
    card,
    header,
    body,
    information
  };
}


// ============================================================
// SEÇÃO EXPANSÍVEL
// ============================================================

function createSection({
  id,
  title,
  description,
  icon,
  help
}) {

  const section =
    document.createElement("section");

  section.className =
    "builder-section";

  section.id =
    id;

  const header =
    document.createElement("div");

  header.className =
    "builder-section-header";

  const left =
    document.createElement("div");

  left.className =
    "builder-section-title-area";

  const iconElement =
    document.createElement("span");

  iconElement.className =
    "builder-section-icon";

  iconElement.textContent =
    icon;

  const titleWrapper =
    document.createElement("div");

  titleWrapper.innerHTML = `
    <h2>
      ${escapeHTML(title)}
    </h2>

    <p>
      ${escapeHTML(description)}
    </p>
  `;

  left.appendChild(
    iconElement
  );

  left.appendChild(
    titleWrapper
  );

  const right =
    document.createElement("div");

  right.className =
    "builder-section-actions";

  if (help) {

    right.appendChild(
      createHelpButton(
        help.title,
        help.text
      )
    );
  }

  const arrow =
    document.createElement("span");

  arrow.className =
    "builder-section-arrow";

  arrow.innerHTML =
    arrowSVG("down");

  right.appendChild(
    arrow
  );

  header.appendChild(left);
  header.appendChild(right);

  const content =
    document.createElement("div");

  content.className =
    "builder-section-content";

  header.addEventListener(
    "click",
    event => {

      if (
        event.target.closest(
          ".help-button"
        )
      ) {
        return;
      }

      section.classList.toggle(
        "collapsed"
      );
    }
  );

  section.appendChild(header);
  section.appendChild(content);

  return {
    section,
    content
  };
}


// ============================================================
// BOTÃO ADICIONAR
// ============================================================

function createAddButton(
  text,
  callback
) {

  const button =
    document.createElement("button");

  button.type =
    "button";

  button.className =
    "builder-add-button";

  button.innerHTML = `
    <span class="builder-add-icon">
      +
    </span>

    <span>
      ${escapeHTML(text)}
    </span>
  `;

  button.addEventListener(
    "click",
    callback
  );

  return button;
}


// ============================================================
// 1. IDENTIDADE
// ============================================================

function buildIdentity(container) {

  const section =
    createSection({
      id: "section-identity",
      title: "Identidade da mesa",
      description: "Dê uma identidade ao seu RPG.",
      icon: "🏰",
      help: {
        title: "Identidade da mesa",
        text: `
          <p>
            Aqui você define apenas as informações básicas da mesa.
          </p>

          <p>
            Não é necessário escolher um sistema.
            A mesa será construída livremente nas próximas etapas.
          </p>
        `
      }
    });

  const nameInput =
    textInput(
      state.identity.name,
      "Ex.: As Crônicas de Avalon"
    );

  nameInput.addEventListener(
    "input",
    () => {
      state.identity.name =
        nameInput.value;
    }
  );

  section.content.appendChild(
    field(
      "Nome da mesa",
      nameInput
    )
  );

  const descriptionInput =
    textarea(
      state.identity.description,
      "Conte um pouco sobre o RPG..."
    );

  descriptionInput.addEventListener(
    "input",
    () => {
      state.identity.description =
        descriptionInput.value;
    }
  );

  section.content.appendChild(
    field(
      "Descrição",
      descriptionInput,
      {
        title: "Descrição da mesa",
        text: `
          <p>
            Use este espaço para apresentar a proposta da mesa.
          </p>

          <p>
            Pode ser uma sinopse, ambientação,
            regras gerais ou contexto da história.
          </p>
        `
      }
    )
  );

  container.appendChild(
    section.section
  );
}


// ============================================================
// 2. ATRIBUTOS
// ============================================================

function buildAttributes(container) {

  const section =
    createSection({
      id: "section-attributes",
      title: "Atributos",
      description: "Crie as características que seus personagens terão.",
      icon: "⚔️",
      help: {
        title: "Atributos",
        text: `
          <p>
            Atributos são características utilizadas pelo seu RPG.
          </p>

          <p>
            Você decide o nome, tipo, valores e regras de utilização.
          </p>

          <p>
            Exemplos:
            Força, Destreza, Inteligência, Chakra,
            Sanidade, Poder etc.
          </p>
        `
      }
    });

  const list =
    document.createElement("div");

  list.className =
    "builder-list";

  section.content.appendChild(
    list
  );


  function render() {

    list.innerHTML = "";

    state.attributes.forEach(
      attribute => {

        const card =
          createExpandableCard({
            title:
              attribute.name ||
              "Novo atributo",

            subtitle:
              codeFromName(
                attribute.name
              ) ||
              "SEM CÓDIGO",

            icon: "⚔️",

            onRemove: () => {

              state.attributes =
                state.attributes.filter(
                  item =>
                    item.id !== attribute.id
                );

              render();
            }
          });


        // ----------------------------------------------------
        // NOME
        // ----------------------------------------------------

        const name =
          textInput(
            attribute.name,
            "Ex.: Força"
          );

        name.addEventListener(
          "input",
          () => {

            attribute.name =
              name.value;

            const generatedCode =
              codeFromName(
                attribute.name
              );

            attribute.code =
              generatedCode;

            card
              .information
              .querySelector(
                ".builder-card-title"
              )
              .textContent =
                attribute.name ||
                "Novo atributo";

            const subtitle =
              card
                .information
                .querySelector(
                  ".builder-card-subtitle"
                );

            if (subtitle) {

              subtitle.textContent =
                generatedCode ||
                "SEM CÓDIGO";
            }
          }
        );

        card.body.appendChild(
          field(
            "Nome",
            name,
            { title: "Nome do atributo", text: `<p>Escolha o nome da característica que será usada pelos personagens.</p><p><strong>Exemplos:</strong> <code>Força</code>, <code>Destreza</code>, <code>Percepção</code>.</p><p>O código usado nas fórmulas é derivado automaticamente desse nome.</p>` }
          )
        );


        // ----------------------------------------------------
        // DESCRIÇÃO
        // ----------------------------------------------------

        const description =
          textarea(
            attribute.description,
            "Explique o que este atributo representa..."
          );

        description.addEventListener(
          "input",
          () => {
            attribute.description =
              description.value;
          }
        );

        card.body.appendChild(
          field(
            "Descrição",
            description,
            { title: "Descrição do atributo", text: `<p>Explique o significado do atributo e o que ele representa dentro do sistema.</p><p><strong>Exemplo:</strong> "Força física, capacidade de levantar peso e aplicar força bruta."</p>` }
          )
        );


        // ----------------------------------------------------
        // TIPO
        // ----------------------------------------------------

        const type =
          customSelect(
            [
              {
                value: "",
                label: "Selecione o tipo"
              },
              {
                value: "number",
                label: "Número"
              },
              {
                value: "text",
                label: "Texto"
              },
              {
                value: "boolean",
                label: "Sim / Não"
              },
              {
                value: "percentage",
                label: "Porcentagem"
              },
              {
                value: "bar",
                label: "Barra"
              }
            ],
            attribute.type
          );

        type.addEventListener(
          "change",
          () => {
            attribute.type =
              type.value;

            // Atualiza somente os campos dependentes do tipo.
            // O card permanece aberto e não é reconstruído.
            renderAttributeValueFields();
          }
        );

        card.body.appendChild(
          field(
            "Tipo",
            type,
            {
              title: "Tipo do atributo",
              text: `
                <p>
                  Define como o valor será armazenado e exibido.
                </p>

                <p>
                  Para atributos utilizados em cálculos,
                  <strong>Número</strong> normalmente é o mais indicado.
                </p>
              `
            }
          )
        );


        // ----------------------------------------------------
        // VALORES DO ATRIBUTO
        // ----------------------------------------------------

        const valueFields =
          document.createElement("div");

        valueFields.className =
          "attribute-value-fields";

        function renderAttributeValueFields() {
          valueFields.innerHTML = "";

          const typeValue = attribute.type;
          const numeric = ["number", "percentage", "bar"].includes(typeValue);

          if (!numeric) {
            const note = document.createElement("div");
            note.className = "builder-inline-note";
            note.innerHTML = `
              <strong>Valor definido na ficha</strong>
              <span>O valor inicial deste atributo será definido quando o personagem for criado na character-sheet.</span>
            `;
            valueFields.appendChild(note);
            return;
          }

          const min = numberInput(attribute.min ?? "", typeValue === "percentage" ? "0%" : "Opcional");
          min.step = typeValue === "number" ? "1" : "any";
          min.addEventListener("input", () => {
            attribute.min = min.value;
          });
          valueFields.appendChild(
            field(
              typeValue === "percentage" ? "Valor mínimo (%)" : "Valor mínimo",
              min,
              { title: "Limite mínimo do atributo", text: `<p>Define o menor valor permitido para este atributo.</p><p><strong>Exemplo:</strong> <code>0</code> impede que o atributo fique abaixo de zero.</p><p>Deixe vazio se a mesa não quiser impor limite mínimo.</p>` }
            )
          );

          const max = numberInput(attribute.max ?? "", typeValue === "percentage" ? "100%" : "Opcional");
          max.step = typeValue === "number" ? "1" : "any";
          max.addEventListener("input", () => {
            attribute.max = max.value;
          });
          valueFields.appendChild(
            field(
              typeValue === "percentage" ? "Valor máximo (%)" : "Valor máximo",
              max,
              { title: "Limite máximo do atributo", text: `<p>Define o maior valor permitido para este atributo.</p><p><strong>Exemplo:</strong> <code>10</code> limita o atributo a 10.</p><p>Em porcentagens, normalmente use <code>100</code> como teto.</p>` }
            )
          );
        }

        card.body.appendChild(valueFields);
        renderAttributeValueFields();

        // ----------------------------------------------------
        // AVANÇADO
        // ----------------------------------------------------

        const advanced =
          document.createElement(
            "details"
          );

        advanced.className =
          "advanced-options";

        advanced.innerHTML = `
          <summary>
            <span>
              Configurações avançadas
            </span>

            ${arrowSVG("down")}
          </summary>

          <div class="advanced-content">

            <label class="checkbox-field">
              <input
                type="checkbox"
                ${attribute.allowModifiers ? "checked" : ""}
              >

              <span>
                Permitir modificadores
              </span>
            </label>

            <label class="checkbox-field">
              <input
                type="checkbox"
                ${attribute.useInFormulas ? "checked" : ""}
              >

              <span>
                Pode ser utilizado em fórmulas
              </span>
            </label>

            <label class="checkbox-field">
              <input
                type="checkbox"
                ${attribute.visibleToPlayers !== false ? "checked" : ""}
              >

              <span>
                Visível para os jogadores
              </span>
            </label>

            <label class="checkbox-field">
              <input
                type="checkbox"
                ${attribute.editableByPlayer ? "checked" : ""}
              >

              <span>
                Jogador pode alterar
              </span>
            </label>

          </div>
        `;

        const checkboxes =
          advanced.querySelectorAll(
            "input[type='checkbox']"
          );

        checkboxes[0]?.addEventListener(
          "change",
          event => {
            attribute.allowModifiers =
              event.target.checked;
          }
        );

        checkboxes[1]?.addEventListener(
          "change",
          event => {
            attribute.useInFormulas =
              event.target.checked;
          }
        );

        checkboxes[2]?.addEventListener(
          "change",
          event => {
            attribute.visibleToPlayers =
              event.target.checked;
          }
        );

        checkboxes[3]?.addEventListener(
          "change",
          event => {
            attribute.editableByPlayer =
              event.target.checked;
          }
        );

        card.body.appendChild(
          advanced
        );

        list.appendChild(
          card.card
        );
      }
    );


    section.content
      .querySelector(
        ".builder-add-button"
      )
      ?.remove();


    section.content.appendChild(
      createAddButton(
        "Adicionar atributo",
        () => {

          state.attributes.push({
            id:
              createId("attribute"),

            name: "",

            description: "",

            code: "",

            type: "",

            min: "",

            max: "",

            allowModifiers: false,

            useInFormulas: false,

            visibleToPlayers: false,

            editableByPlayer: false
          });

          render();
        }
      )
    );
  }


  render();

  container.appendChild(
    section.section
  );
}


// ============================================================
// 3. RECURSOS
// ============================================================

function buildResources(container) {

  const section =
    createSection({
      id: "section-resources",
      title: "Recursos",
      description: "Crie valores que podem aumentar ou diminuir.",
      icon: "❤️",
      help: {
        title: "Recursos",
        text: `
          <p>
            Recursos possuem normalmente um valor atual
            e um valor máximo.
          </p>

          <p>
            Exemplos:
            Vida, Mana, Energia, Sanidade,
            Chakra, Stamina etc.
          </p>
        `
      }
    });

  const list =
    document.createElement("div");

  list.className =
    "builder-list";

  section.content.appendChild(
    list
  );


  function render() {

    list.innerHTML = "";

    state.resources.forEach(
      resource => {

        const card =
          createExpandableCard({
            title:
              resource.name ||
              "Novo recurso",

            subtitle:
              codeFromName(
                resource.name
              ) ||
              "SEM CÓDIGO",

            icon: "❤️",

            onRemove: () => {

              state.resources =
                state.resources.filter(
                  item =>
                    item.id !== resource.id
                );

              render();
            }
          });


        const name =
          textInput(
            resource.name,
            "Ex.: Vida"
          );

        name.addEventListener(
          "input",
          () => {

            resource.name =
              name.value;

            resource.code =
              codeFromName(
                name.value
              );

            card
              .information
              .querySelector(
                ".builder-card-title"
              )
              .textContent =
                resource.name ||
                "Novo recurso";

            card
              .information
              .querySelector(
                ".builder-card-subtitle"
              )
              .textContent =
                resource.code ||
                "SEM CÓDIGO";
          }
        );

        card.body.appendChild(
          field(
            "Nome",
            name,
            { title: "Nome do recurso", text: `<p>É o nome pelo qual o recurso será reconhecido na ficha.</p><p><strong>Exemplos:</strong> <code>Vida</code>, <code>Mana</code>, <code>Energia</code>.</p>` }
          )
        );


        const description =
          textarea(
            resource.description,
            "Explique o que este recurso representa..."
          );

        description.addEventListener(
          "input",
          () => {
            resource.description =
              description.value;
          }
        );

        card.body.appendChild(
          field(
            "Descrição",
            description,
            { title: "Descrição do recurso", text: `<p>Explique o que este recurso representa e como ele deve ser interpretado.</p><p><strong>Exemplo:</strong> "Pontos de vida do personagem; chegam a zero quando ele é derrotado."</p>` }
          )
        );


        const maximum =
          textInput(
            resource.maxValue ?? "",
            "Ex.: 100 ou [FOR*10]"
          );

        maximum.addEventListener(
          "input",
          () => {
            resource.maxValue = maximum.value;
          }
        );

        card.body.appendChild(
          field(
            "Valor máximo",
            maximum,
            {
              title: "Valor máximo do recurso",
              text: `
                <p>Este é o próprio campo onde você informa o limite máximo do recurso. Não é necessário escolher antes se ele será número ou fórmula.</p>
                <p><strong>Número direto:</strong> <code>100</code></p>
                <p><strong>Fórmula:</strong> <code>[FOR*10]</code></p>
                <hr>
                <p><strong>Como ler uma fórmula:</strong></p>
                <p><code>[ATR op valor]</code></p>
                <ul>
                  <li><code>FOR</code> = código do atributo Força.</li>
                  <li><code>+</code> = soma.</li>
                  <li><code>-</code> = subtração.</li>
                  <li><code>*</code> = multiplicação.</li>
                  <li><code>/</code> = divisão.</li>
                  <li><code>!</code> = usa a quantidade atual daquele atributo na ficha.</li>
                </ul>
                <p><strong>Exemplo:</strong> se FOR = 6, <code>[FOR*10]</code> produz 60.</p>
              `
            }
          )
        );

        list.appendChild(
          card.card
        );
      }
    );


    section.content
      .querySelector(
        ".builder-add-button"
      )
      ?.remove();


    section.content.appendChild(
      createAddButton(
        "Adicionar recurso",
        () => {

          state.resources.push({
            id:
              createId("resource"),

            name: "",

            description: "",

            code: "",

            maxValue: ""
          });

          render();
        }
      )
    );
  }


  render();

  container.appendChild(
    section.section
  );
}


// ============================================================
// 4. PERÍCIAS
// ============================================================

function buildSkills(container) {

  const section =
    createSection({
      id: "section-skills",
      title: "Perícias",
      description: "Crie conhecimentos, especialidades ou testes.",
      icon: "🎯",
      help: {
        title: "Perícias",
        text: `
          <p>
            Perícias podem representar conhecimentos,
            técnicas ou testes específicos.
          </p>
        `
      }
    });

  const list =
    document.createElement("div");

  list.className =
    "builder-list";

  section.content.appendChild(
    list
  );


  function render() {

    list.innerHTML = "";

    state.skills.forEach(
      skill => {

        const card =
          createExpandableCard({
            title:
              skill.name ||
              "Nova perícia",

            subtitle:
              "Perícia",

            icon:
              "🎯",

            onRemove: () => {

              state.skills =
                state.skills.filter(
                  item =>
                    item.id !== skill.id
                );

              render();
            }
          });


        const name =
          textInput(
            skill.name,
            "Ex.: Furtividade"
          );

        name.addEventListener(
          "input",
          () => {

            skill.name =
              name.value;

            card
              .information
              .querySelector(
                ".builder-card-title"
              )
              .textContent =
                skill.name ||
                "Nova perícia";
          }
        );

        card.body.appendChild(
          field(
            "Nome",
            name,
            { title: "Nome da perícia", text: `<p>É o nome da perícia que o personagem poderá possuir e evoluir.</p><p><strong>Exemplos:</strong> <code>Furtividade</code>, <code>Percepção</code>, <code>Medicina</code>.</p>` }
          )
        );


        const description =
          textarea(
            skill.description,
            "Descrição da perícia..."
          );

        description.addEventListener(
          "input",
          () => {
            skill.description =
              description.value;
          }
        );

        card.body.appendChild(
          field(
            "Descrição",
            description,
            { title: "Descrição da perícia", text: `<p>Explique o efeito da perícia e declare aqui os bônus por fórmula.</p><p><strong>Exemplo:</strong> <code>[DES+2]</code> concede 2 pontos de Destreza à rolagem.</p><p><code>[DES+!]</code> usa a Destreza atual da ficha; <code>[CON+!/2]</code> usa metade da Constituição, arredondada para baixo.</p>` }
          )
        );


        list.appendChild(
          card.card
        );
      }
    );


    section.content
      .querySelector(
        ".builder-add-button"
      )
      ?.remove();


    section.content.appendChild(
      createAddButton(
        "Adicionar perícia",
        () => {

          state.skills.push({
            id:
              createId("skill"),

            name: "",

            description: ""
          });

          render();
        }
      )
    );
  }


  render();

  container.appendChild(
    section.section
  );
}


// ============================================================
// DESCRIÇÃO COM PARSERS
// ============================================================

function buildDescriptionField(
  item,
  label = "Descrição",
  customHelp = null
) {

  const wrapper =
    document.createElement("div");

  const description =
    textarea(
      item.description,
      "Escreva a descrição normalmente..."
    );

  description.addEventListener(
    "input",
    () => {
      item.description =
        description.value;
    }
  );

  wrapper.appendChild(
    field(
      label,
      description,
      {
        title: customHelp?.title ||
          "Descrição e parsers",

        text: customHelp?.text || `
          <p>
            A descrição é um texto livre.
          </p>

          <p>
            Você também pode inserir parsers diretamente no texto.
          </p>

          <ul>
            <li><strong>[FOR+3]</strong> adiciona 3 a FOR.</li>
            <li><strong>[DES-2]</strong> reduz 2 de DES.</li>
            <li><strong>[HP-10]</strong> reduz 10 de HP.</li>
            <li><strong>[+1D20]</strong> adiciona um D20.</li>
            <li><strong>[-1D6]</strong> remove um D6.</li>
          </ul>
        `
      }
    )
  );

  return wrapper;
}


// ============================================================
// 5. HABILIDADES
// ============================================================

function buildAbilities(container) {

  const section =
    createSection({
      id: "section-abilities",
      title: "Habilidades",
      description: "Defina os tipos de habilidades que poderão existir na mesa.",
      icon: "✨",
      help: {
        title: "Habilidades",
        text: `
          <p>Aqui você cria os <strong>tipos</strong> de habilidade que o sistema reconhece.</p>
          <p>O campo é livre para o Mestre criar a nomenclatura que quiser.</p>
          <p><strong>Exemplos:</strong> Passiva, Ativa, Ritualística, Invocática, Evocativa.</p>
          <p>O nome da habilidade e seus efeitos pertencem à ficha do personagem; aqui você define apenas as categorias disponíveis.</p>
        `
      }
    });

  const list = document.createElement("div");
  list.className = "builder-list";
  section.content.appendChild(list);

  function render() {
    list.innerHTML = "";

    state.abilities.forEach(ability => {
      const card = createExpandableCard({
        title: ability.type || "Novo tipo de habilidade",
        subtitle: "Tipo de habilidade",
        icon: "✨",
        onRemove: () => {
          state.abilities = state.abilities.filter(item => item.id !== ability.id);
          render();
        }
      });

      const type = textInput(ability.type || "", "Ex.: Passiva, Ativa, Ritualística...");
      type.addEventListener("input", () => {
        ability.type = type.value;
        card.information.querySelector(".builder-card-title").textContent = ability.type || "Novo tipo de habilidade";
      });

      card.body.appendChild(field("Tipo", type, {
        title: "Tipo de habilidade",
        text: `
          <p>Digite o nome da categoria de habilidade que você quer disponibilizar na mesa.</p>
          <p><strong>Exemplos:</strong></p>
          <ul>
            <li><strong>Passiva</strong> — efeito permanente ou automático.</li>
            <li><strong>Ativa</strong> — precisa ser acionada pelo jogador.</li>
            <li><strong>Ritualística</strong> — exige um ritual ou preparação.</li>
            <li><strong>Invocática</strong> — cria ou chama algo.</li>
            <li><strong>Evocativa</strong> — manifesta um efeito ou energia.</li>
          </ul>
          <p>Você também pode criar nomes próprios para o seu sistema.</p>
        `
      }));

      list.appendChild(card.card);
    });

    section.content.querySelector(".builder-add-button")?.remove();
    section.content.appendChild(createAddButton("Adicionar tipo de habilidade", () => {
      state.abilities.push({ id: createId("ability"), type: "" });
      render();
    }));
  }

  render();
  container.appendChild(section.section);
}


// ============================================================
// 6. EQUIPAMENTOS
// ============================================================
// Esta tela define apenas as regras do sistema de equipamentos.
// Os equipamentos propriamente ditos serão criados na character-sheet.

function buildEquipmentConfig(container) {

  const section = createSection({
    id: "section-equipment-config",
    title: "Sistemas de equipamentos e finanças",
    description: "Configure separadamente o inventário e o sistema financeiro da mesa.",
    icon: "🛡️",
    help: {
      title: "Equipamentos e finanças",
      text: `
        <p>Equipamentos e finanças são sistemas independentes.</p>
        <p>Ativar ou desativar um deles não altera o outro.</p>
      `
    }
  });

  const settings = state.equipmentSettings;

  // ============================================================
  // EQUIPAMENTOS — independente
  // ============================================================
  const equipmentBlock = document.createElement("div");
  equipmentBlock.className = "system-config-block equipment-system-block";

  const equipmentEnabled = document.createElement("label");
  equipmentEnabled.className = "checkbox-field equipment-setting-toggle";
  equipmentEnabled.innerHTML = `
    <input type="checkbox" ${settings.enabled ? "checked" : ""}>
    <span class="system-toggle-content">
      <strong>Usar sistema de equipamentos</strong>
      <small>Habilita inventário, equipamentos e regras de carga.</small>
    </span>
  `;

  const equipmentContent = document.createElement("div");
  equipmentContent.className = "equipment-config-content";

  equipmentEnabled.appendChild(createHelpButton("Sistema de equipamentos", `<p>Ative para disponibilizar inventário e regras de carga aos personagens.</p><p><strong>Exemplo:</strong> uma campanha que controla slots, peso ou tipos de equipamento.</p>`));

  equipmentEnabled.querySelector("input").addEventListener("change", event => {
    settings.enabled = event.target.checked;
    equipmentContent.classList.toggle("is-disabled", !settings.enabled);
  });

  equipmentBlock.appendChild(equipmentEnabled);

  const equipmentSettingsTitle = document.createElement("div");
  equipmentSettingsTitle.className = "system-config-subtitle";
  equipmentSettingsTitle.textContent = "Configurações";
  equipmentContent.appendChild(equipmentSettingsTitle);

  const loadSelect = customSelect([
    { value: "", label: "Selecione o sistema" },
    { value: "free", label: "Livre / Sem limite" },
    { value: "slot", label: "Slot" },
    { value: "weight", label: "Peso" },
    { value: "unit", label: "Unidade" },
    { value: "custom", label: "Personalizado" }
  ], settings.loadSystem);

  equipmentContent.appendChild(field("Sistema de carga", loadSelect, { title: "Sistema de carga", text: `<p>Escolha como o inventário será limitado.</p><ul><li><strong>Livre / Sem limite:</strong> nenhuma restrição.</li><li><strong>Slot:</strong> limita por espaços.</li><li><strong>Peso:</strong> limita por kg ou lbs.</li><li><strong>Unidade:</strong> limita por quantidade.</li><li><strong>Personalizado:</strong> cria seu próprio nome e limite.</li></ul>` }));

  const loadDetails = document.createElement("div");
  loadDetails.className = "equipment-load-details";
  equipmentContent.appendChild(loadDetails);

  function textNumber(label, value, placeholder, onInput) {
    const input = document.createElement("input");
    input.type = "text";
    input.className = "builder-input";
    input.inputMode = "decimal";
    input.value = value ?? "";
    input.placeholder = placeholder || "";
    input.addEventListener("input", () => onInput(input.value));
    const helpMap = {
      "Quantidade de slots": { title: "Quantidade de slots", text: `<p>Define quantos espaços existem no inventário.</p><p><strong>Exemplo:</strong> <code>20</code> cria 20 slots disponíveis.</p>` },
      "Máximo de fragmentos por slot": { title: "Máximo de fragmentos por slot", text: `<p>Define quantas unidades do mesmo item podem ocupar um slot.</p><p>Deixe vazio para não impor limite.</p><p><strong>Exemplo:</strong> <code>10</code> permite até 10 unidades por slot.</p>` },
      "Limite de peso": { title: "Limite de peso", text: `<p>Define quanto o personagem pode carregar na unidade escolhida.</p><p><strong>Exemplo direto:</strong> <code>50</code>.</p><p><strong>Exemplo com atributo:</strong> <code>[FOR!*10]</code>. Se FOR = 6, o limite será 60.</p>` },
      "Valor máximo": { title: "Valor máximo deste sistema", text: `<p>É o limite de unidades que o personagem pode possuir.</p><p><strong>Exemplo:</strong> <code>100</code> permite até 100 unidades.</p>` },
      "Nome": { title: "Nome do limite personalizado", text: `<p>Defina como será chamado o limite criado por você.</p><p><strong>Exemplo:</strong> <code>Espaço de inventário</code> ou <code>Pontos de carga</code>.</p>` }
    };
    return field(label, input, helpMap[label] || null);
  }

  function renderLoadDetails() {
    loadDetails.innerHTML = "";

    if (settings.loadSystem === "slot") {
      loadDetails.appendChild(textNumber(
        "Quantidade de slots",
        settings.slotCount,
        "Ex.: 20",
        value => { settings.slotCount = value; }
      ));
      loadDetails.appendChild(textNumber(
        "Máximo de fragmentos por slot",
        settings.maxItemsPerSlot,
        "Vazio = infinito",
        value => { settings.maxItemsPerSlot = value; }
      ));
      return;
    }

    if (settings.loadSystem === "weight") {
      const weightUnit = customSelect([
        { value: "", label: "Selecione a unidade" },
        { value: "kg", label: "kg" },
        { value: "lbs", label: "lbs" }
      ], settings.weightUnit || "kg");
      weightUnit.addEventListener("change", () => {
        settings.weightUnit = weightUnit.value;
      });
      loadDetails.appendChild(field("Unidade", weightUnit, { title: "Unidade do peso", text: `<p>Escolha a unidade usada para medir o limite de peso.</p><p><strong>Exemplo:</strong> <code>kg</code> para quilogramas ou <code>lbs</code> para libras.</p>` }));
      loadDetails.appendChild(textNumber(
        "Limite de peso",
        settings.weightLimit,
        "Ex.: 50 ou [FOR*10]",
        value => { settings.weightLimit = value; }
      ));
      return;
    }

    if (settings.loadSystem === "unit") {
      loadDetails.appendChild(textNumber(
        "Valor máximo",
        settings.unitMax,
        "Ex.: 100",
        value => { settings.unitMax = value; }
      ));
      return;
    }

    if (settings.loadSystem === "custom") {
      loadDetails.appendChild(textNumber(
        "Nome",
        settings.customEquipmentName,
        "Ex.: Espaço de inventário",
        value => { settings.customEquipmentName = value; }
      ));
      loadDetails.appendChild(textNumber(
        "Valor máximo",
        settings.customEquipmentMax,
        "Ex.: 10 ou [FOR*10]",
        value => { settings.customEquipmentMax = value; }
      ));
    }
  }

  loadSelect.addEventListener("change", () => {
    settings.loadSystem = loadSelect.value;
    renderLoadDetails();
  });

  renderLoadDetails();

  function equipmentListSetting(title, key, placeholder) {
    const wrap = document.createElement("div");
    wrap.className = "equipment-config-list";

    const input = textInput("", placeholder);
    const add = createAddButton("Adicionar", () => {
      const value = input.value.trim();
      if (!value) return;
      settings[key].push(value);
      input.value = "";
      renderList();
    });

    const items = document.createElement("div");
    items.className = "equipment-config-items";

    function renderList() {
      items.innerHTML = "";
      settings[key].forEach((value, index) => {
        const item = document.createElement("div");
        item.className = "equipment-config-item";
        item.innerHTML = `
          <span>${escapeHTML(value)}</span>
          <button type="button" aria-label="Remover">×</button>
        `;
        item.querySelector("button").addEventListener("click", () => {
          settings[key].splice(index, 1);
          renderList();
        });
        items.appendChild(item);
      });
    }

    const listHelp = title === "Variedades de equipamentos"
      ? { title, text: `<p>Cadastre as categorias de itens que existirão na mesa.</p><p><strong>Exemplos:</strong> <code>Arma</code>, <code>Armadura</code>, <code>Consumível</code>, <code>Ferramenta</code>.</p>` }
      : { title, text: `<p>Cadastre uma categoria que poderá ser usada no sistema.</p><p><strong>Exemplo:</strong> escolha um nome curto e claro para identificar a categoria.</p>` };
    wrap.appendChild(field(title, input, listHelp));
    wrap.appendChild(add);
    wrap.appendChild(items);
    renderList();
    return wrap;
  }

  equipmentContent.appendChild(equipmentListSetting(
    "Variedades de equipamentos",
    "equipmentTypes",
    "Ex.: Arma, armadura, consumível..."
  ));

  equipmentBlock.appendChild(equipmentContent);
  section.content.appendChild(equipmentBlock);

  // ============================================================
  // FINANÇAS — independente
  // ============================================================
  const financeBlock = document.createElement("div");
  financeBlock.className = "system-config-block finance-system-block";

  const financeEnabled = document.createElement("label");
  financeEnabled.className = "checkbox-field finance-setting-toggle";
  financeEnabled.innerHTML = `
    <input type="checkbox" ${settings.financeEnabled ? "checked" : ""}>
    <span class="system-toggle-content">
      <strong>Usar sistema financeiro</strong>
      <small>Permite dinheiro, preços e transações na character-sheet.</small>
    </span>
  `;

  const financeContent = document.createElement("div");
  financeContent.className = "finance-config-content";

  financeEnabled.appendChild(createHelpButton("Sistema financeiro", `<p>Ative para permitir moedas, preços e transações na ficha.</p><p><strong>Exemplo:</strong> Ouro, Prata e Créditos como moedas independentes.</p>`));

  financeEnabled.querySelector("input").addEventListener("change", event => {
    settings.financeEnabled = event.target.checked;
    financeContent.classList.toggle("is-disabled", !settings.financeEnabled);
  });

  financeBlock.appendChild(financeEnabled);

  const financeSettingsTitle = document.createElement("div");
  financeSettingsTitle.className = "system-config-subtitle";
  financeSettingsTitle.textContent = "Configurações";
  financeContent.appendChild(financeSettingsTitle);

  function currencyListSetting() {
    const wrap = document.createElement("div");
    wrap.className = "equipment-config-list";

    const input = textInput("", "Ex.: Ouro, prata, crédito...");
    const add = createAddButton("Adicionar", () => {
      const value = input.value.trim();
      if (!value) return;
      settings.currencyTypes.push(value);
      input.value = "";
      renderList();
    });

    const items = document.createElement("div");
    items.className = "equipment-config-items";

    function renderList() {
      items.innerHTML = "";
      settings.currencyTypes.forEach((value, index) => {
        const item = document.createElement("div");
        item.className = "equipment-config-item";
        item.innerHTML = `
          <span>${escapeHTML(value)}</span>
          <button type="button" aria-label="Remover">×</button>
        `;
        item.querySelector("button").addEventListener("click", () => {
          settings.currencyTypes.splice(index, 1);
          renderList();
        });
        items.appendChild(item);
      });
    }

    wrap.appendChild(field("Variedades de moedas", input, { title: "Variedade de moedas", text: `<p>Adicione uma moeda que poderá aparecer na ficha.</p><p><strong>Exemplos:</strong> <code>Ouro</code>, <code>Prata</code>, <code>Créditos</code> ou <code>Fragmentos</code>.</p>` }));
    wrap.appendChild(add);
    wrap.appendChild(items);
    renderList();
    return wrap;
  }

  financeContent.appendChild(currencyListSetting());
  financeBlock.appendChild(financeContent);
  section.content.appendChild(financeBlock);

  renderLoadDetails();
  equipmentContent.classList.toggle("is-disabled", !settings.enabled);
  financeContent.classList.toggle("is-disabled", !settings.financeEnabled);

  container.appendChild(section.section);
}


// 7. ESTADOS
// ============================================================

function buildStates(container) {

  const section =
    createSection({
      id: "section-states",
      title: "Estados",
      description: "Crie condições que podem afetar personagens.",
      icon: "🩸",
      help: {
        title: "Estados",
        text: `
          <p>
            Estados representam condições temporárias ou permanentes.
          </p>

          <p>
            Exemplos:
            Envenenado, Atordoado, Sangrando,
            Amaldiçoado, Queimando etc.
          </p>
        `
      }
    });

  const list =
    document.createElement("div");

  list.className =
    "builder-list";

  section.content.appendChild(
    list
  );


  function render() {

    list.innerHTML = "";

    state.states.forEach(
      item => {

        const card =
          createExpandableCard({
            title:
              item.name ||
              "Novo estado",

            subtitle:
              "Estado",

            icon:
              "🩸",

            onRemove: () => {

              state.states =
                state.states.filter(
                  element =>
                    element.id !== item.id
                );

              render();
            }
          });


        const name =
          textInput(
            item.name,
            "Ex.: Envenenado"
          );

        name.addEventListener(
          "input",
          () => {

            item.name =
              name.value;

            card
              .information
              .querySelector(
                ".builder-card-title"
              )
              .textContent =
                item.name ||
                "Novo estado";
          }
        );

        card.body.appendChild(
          field(
            "Nome",
            name,
            { title: "Nome do estado", text: `<p>É o nome da condição que poderá aparecer no personagem.</p><p><strong>Exemplos:</strong> <code>Envenenado</code>, <code>Atordoado</code>, <code>Sangrando</code>.</p>` }
          )
        );


        card.body.appendChild(
          buildDescriptionField(
            item,
            "Descrição",
            { title: "Descrição do estado", text: `<p>Explique o efeito do estado e, se necessário, inclua fórmulas para aplicar modificadores.</p><p><strong>Exemplo:</strong> <code>[DES-2]</code> para representar uma penalidade de 2 pontos de Destreza.</p>` }
          )
        );


        list.appendChild(
          card.card
        );
      }
    );


    section.content
      .querySelector(
        ".builder-add-button"
      )
      ?.remove();


    section.content.appendChild(
      createAddButton(
        "Adicionar estado",
        () => {

          state.states.push({
            id:
              createId("state"),

            name: "",

            description: ""
          });

          render();
        }
      )
    );
  }


  render();

  container.appendChild(
    section.section
  );
}


// ============================================================
// 8. CAMPOS PERSONALIZADOS
// ============================================================

function buildCustomFields(container) {

  const section =
    createSection({
      id: "section-custom-fields",
      title: "Campos personalizados",
      description: "Adicione informações que não cabem nas outras peças.",
      icon: "📝",
      help: {
        title: "Campos personalizados",
        text: `
          <p>
            Aqui você pode criar campos livres para a ficha.
          </p>

          <p>
            Exemplos:
            Clã, profissão, idade, história,
            aparência, patente, título etc.
          </p>
        `
      }
    });

  const list =
    document.createElement("div");

  list.className =
    "builder-list";

  section.content.appendChild(
    list
  );


  function render() {

    list.innerHTML = "";

    state.customFields.forEach(
      item => {

        const card =
          createExpandableCard({
            title:
              item.name ||
              "Novo campo",

            subtitle:
              item.type,

            icon:
              "📝",

            onRemove: () => {

              state.customFields =
                state.customFields.filter(
                  element =>
                    element.id !== item.id
                );

              render();
            }
          });


        const name =
          textInput(
            item.name,
            "Ex.: Clã"
          );

        name.addEventListener(
          "input",
          () => {

            item.name =
              name.value;

            card
              .information
              .querySelector(
                ".builder-card-title"
              )
              .textContent =
                item.name ||
                "Novo campo";
          }
        );

        card.body.appendChild(
          field(
            "Nome",
            name,
            { title: "Nome do campo personalizado", text: `<p>É o rótulo que aparecerá para o jogador na ficha.</p><p><strong>Exemplos:</strong> <code>Clã</code>, <code>Profissão</code>, <code>Título</code>.</p>` }
          )
        );


        const type =
          customSelect(
            [
              {
                value: "text",
                label: "Texto"
              },
              {
                value: "long-text",
                label: "Texto longo"
              },
              {
                value: "number",
                label: "Número"
              },
              {
                value: "boolean",
                label: "Sim / Não"
              },
              {
                value: "select",
                label: "Seleção"
              },
              {
                value: "date",
                label: "Data"
              }
            ],
            item.type
          );

        type.addEventListener(
          "change",
          () => {

            item.type =
              type.value;

            card
              .information
              .querySelector(
                ".builder-card-subtitle"
              )
              .textContent =
                item.type;

            renderCustomFieldOptions();
          }
        );

        card.body.appendChild(
          field(
            "Tipo",
            type,
            { title: "Tipo do campo personalizado", text: `<p>Define como o jogador preencherá esta informação.</p><p><strong>Exemplos:</strong> Texto para nomes, Número para quantidades, Sim/Não para escolhas binárias ou Seleção para uma lista fechada.</p>` }
          )
        );


        const description =
          textarea(
            item.description,
            "Explique para que serve este campo..."
          );

        description.addEventListener(
          "input",
          () => {
            item.description =
              description.value;
          }
        );

        card.body.appendChild(
          field(
            "Descrição",
            description,
            { title: "Descrição do campo personalizado", text: `<p>Explique ao jogador o que deve ser informado nesse campo.</p><p><strong>Exemplo:</strong> "Informe o nome do clã ao qual o personagem pertence."</p>` }
          )
        );


        const optionsContainer =
          document.createElement("div");

        optionsContainer.className =
          "custom-field-options";

        function renderCustomFieldOptions() {

          optionsContainer.innerHTML = "";

          if (item.type !== "select") {
            return;
          }

          const options =
            textInput(
              (item.options || []).join("; "),
              "Ex.: pequena; média; grande"
            );

          options.addEventListener(
            "input",
            () => {

              item.options =
                options.value
                  .split(";")
                  .map(
                    value =>
                      value.trim()
                  )
                  .filter(Boolean);
            }
          );

          optionsContainer.appendChild(
            field(
              "Opções",
              options,
              {
                title: "Opções disponíveis",
                text: `<p>Digite as opções disponíveis separadas por ponto e vírgula (<code>;</code>).</p><p><strong>Exemplo:</strong> <code>pequena; média; grande</code></p><p>Cada item separado por <code>;</code> aparecerá como uma escolha independente para o jogador.</p>`
              }
            )
          );
        }

        card.body.appendChild(
          optionsContainer
        );

        renderCustomFieldOptions();


        list.appendChild(
          card.card
        );
      }
    );


    section.content
      .querySelector(
        ".builder-add-button"
      )
      ?.remove();


    section.content.appendChild(
      createAddButton(
        "Adicionar campo",
        () => {

          state.customFields.push({
            id:
              createId("field"),

            name: "",

            type: "text",

            description: "",

            options: []
          });

          render();
        }
      )
    );
  }


  render();

  container.appendChild(
    section.section
  );
}


// ============================================================
// 9. FÓRMULAS
// ============================================================

// ============================================================
// 10. DADOS
// ============================================================

function buildDice(container) {

  const section =
    createSection({
      id: "section-dice",
      title: "Dados",
      description: "Escolha quais dados estarão disponíveis nesta mesa.",
      icon: "🎲",
      help: {
        title: "Dados da mesa",
        text: `
          <p>
            Selecione os dados que poderão ser utilizados
            durante o RPG.
          </p>

          <p>
            O D100 é formado por dois dados D10.
          </p>
        `
      }
    });


  const grid =
    document.createElement("div");

  grid.className =
    "dice-builder-grid";


  const diceDefinitions = [
    {
      sides: 2,
      className: "dice-d2",
      render: () =>
        renderSVG_D2()
    },

    {
      sides: 4,
      className: "dice-d4",
      render: () =>
        renderSVG_D4()
    },

    {
      sides: 6,
      className: "dice-d6",
      render: () =>
        renderSVG_D6()
    },

    {
      sides: 8,
      className: "dice-d8",
      render: () =>
        renderSVG_D8()
    },

    {
      sides: 10,
      className: "dice-d10",
      render: () =>
        renderSVG_D10()
    },

    {
      sides: 12,
      className: "dice-d12",
      render: () =>
        renderSVG_D12()
    },

    {
      sides: 20,
      className: "dice-d20",
      render: () =>
        renderSVG_D20()
    },

    {
      sides: 100,
      className: "dice-d100",
      render: () => `
        <div class="dice-d100-double">
          <div class="dice-d100-part">
            ${renderSVG_D10()}
          </div>

          <div class="dice-d100-part">
            ${renderSVG_D10()}
          </div>
        </div>
      `
    }
  ];


  diceDefinitions.forEach(
    definition => {

      const button =
        document.createElement("button");

      button.type =
        "button";

      button.className =
        `dice-builder-option ${definition.className}`;


      const selected =
        state.dice.includes(
          definition.sides
        );

      if (selected) {
        button.classList.add(
          "selected"
        );
      }


      button.innerHTML = `
        <div class="dice-visual">
          ${definition.render()}
        </div>

        <div class="dice-label">
          D${definition.sides}
        </div>
      `;


      button.addEventListener(
        "click",
        () => {

          if (
            state.dice.includes(
              definition.sides
            )
          ) {

            state.dice =
              state.dice.filter(
                value =>
                  value !==
                  definition.sides
              );

            button.classList.remove(
              "selected"
            );

          } else {

            state.dice.push(
              definition.sides
            );

            state.dice.sort(
              (a, b) =>
                a - b
            );

            button.classList.add(
              "selected"
            );
          }
        }
      );


      grid.appendChild(
        button
      );
    }
  );


  section.content.appendChild(
    grid
  );


  const note =
    document.createElement("div");

  note.className =
    "builder-note";

  note.innerHTML = `
    <strong>💡 Como funciona</strong>

    <p>
      Os dados selecionados ficarão disponíveis
      para as rolagens desta mesa.
    </p>

    <p>
      O D100 utiliza dois dados D10.
    </p>
  `;

  section.content.appendChild(
    note
  );


  container.appendChild(
    section.section
  );
}


// ============================================================
// AMIGOS
// ============================================================

// ============================================================
// VALIDAÇÃO
// ============================================================

function validateTable() {

  const errors =
    [];


  if (
    !state.identity.name.trim()
  ) {

    errors.push(
      "Informe o nome da mesa."
    );
  }


  const usedAttributeCodes =
    new Set();


  for (
    const attribute of state.attributes
  ) {

    if (
      !attribute.name.trim()
    ) {

      errors.push(
        "Existe um atributo sem nome."
      );

      continue;
    }


    const generatedCode =
      codeFromName(
        attribute.name
      );

    attribute.code =
      generatedCode;


    if (
      generatedCode
    ) {

      if (
        usedAttributeCodes.has(
          generatedCode
        )
      ) {

        errors.push(
          `O código de atributo "${generatedCode}" está repetido.`
        );
      }

      usedAttributeCodes.add(
        generatedCode
      );
    }
  }


  const usedResourceCodes =
    new Set();


  for (
    const resource of state.resources
  ) {

    if (
      !resource.name.trim()
    ) {

      errors.push(
        "Existe um recurso sem nome."
      );

      continue;
    }


    const generatedCode =
      codeFromName(
        resource.name
      );

    resource.code =
      generatedCode;


    if (
      generatedCode
    ) {

      if (
        usedResourceCodes.has(
          generatedCode
        )
      ) {

        errors.push(
          `O código de recurso "${generatedCode}" está repetido.`
        );
      }

      usedResourceCodes.add(
        generatedCode
      );
    }
  }


  if (
    state.dice.length === 0
  ) {

    errors.push(
      "Escolha pelo menos um dado para a mesa."
    );
  }


  return errors;
}


// ============================================================
// PREPARAÇÃO DOS DADOS
// ============================================================

function buildTableData() {

  // Valores iniciais pertencem à character-sheet.
  // Removemos qualquer propriedade legada antes de salvar a configuração.
  const attributes = state.attributes.map(attribute => {
    const clean = { ...attribute };
    delete clean.initialValue;
    return clean;
  });

  const resources = state.resources.map(resource => {
    const clean = { ...resource };
    delete clean.initialValue;
    return clean;
  });

  return {

    name:
      state.identity.name.trim(),

    description:
      state.identity.description.trim(),

    ownerId:
      state.currentUser.uid,

    // O editor não altera participantes.
    // A lista existente é preservada integralmente.
    members:
      Array.isArray(state.existingMembers)
        ? state.existingMembers
        : [state.currentUser.uid],

    settings:
      state.existingSettings && Object.keys(state.existingSettings).length
        ? state.existingSettings
        : {
            private: true,
            ownerCanManageMembers: true
          },

    configuration: {

      attributes,

      resources,

      skills:
        state.skills,

      abilities:
        state.abilities,

      equipmentSettings:
        state.equipmentSettings,

      states:
        state.states,

      customFields:
        state.customFields,

      dice:
        state.dice
    },

    updatedAt:
      serverTimestamp()
  };
}


// ============================================================
// SALVAR MESA
// ============================================================

async function saveTable(
  saveButton = null
) {

  if (
    state.saving
  ) {
    return;
  }


  const errors =
    validateTable();


  if (
    errors.length > 0
  ) {

    showMessage(
      errors[0],
      "error"
    );

    return;
  }


  if (
    !state.currentUser ||
    !state.editTableId
  ) {

    showMessage(
      "Não foi possível identificar a mesa que será editada.",
      "error"
    );

    return;
  }


  state.saving =
    true;


  if (
    saveButton
  ) {

    saveButton.disabled =
      true;

    saveButton.textContent =
      "Salvando alterações...";
  }


  try {

    const tableRef =
      doc(
        db,
        "tables",
        state.editTableId
      );


    const tableData =
      buildTableData();


    await updateDoc(
      tableRef,
      tableData
    );


    showMessage(
      "Alterações salvas com sucesso!",
      "success"
    );


    setTimeout(
      () => {
        if (window.router?.navigate) {
          window.router.navigate(
            `/game/${encodeURIComponent(state.editTableId)}`
          );
        } else {
          window.dispatchEvent(
            new CustomEvent(
              "rpg:navigate",
              {
                detail: {
                  route: "/game/" + state.editTableId,
                  tableId: state.editTableId
                }
              }
            )
          );
        }
      },
      800
    );


  } catch (error) {

    console.error(
      "Erro ao salvar alterações da mesa:",
      error
    );


    showMessage(
      "Não foi possível salvar as alterações. Tente novamente.",
      "error"
    );


  } finally {

    state.saving =
      false;


    if (
      saveButton
    ) {

      saveButton.disabled =
        false;

      saveButton.textContent =
        "💾 Salvar alterações";
    }
  }
}


// ============================================================
// RESUMO
// ============================================================

function buildSummary(container) {

  const section =
    document.createElement("section");

  section.className =
    "builder-summary";


  section.innerHTML = `

    <div class="builder-summary-header">

      <div>

        <h2>
          Resumo da mesa
        </h2>

        <p>
          Confira as configurações antes de salvar as alterações.
        </p>

      </div>

      <span class="builder-summary-icon">
        📜
      </span>

    </div>


    <div class="builder-summary-grid">

      <div class="summary-item">
        <strong>Atributos</strong>
        <span data-summary="attributes">0</span>
      </div>

      <div class="summary-item">
        <strong>Recursos</strong>
        <span data-summary="resources">0</span>
      </div>

      <div class="summary-item">
        <strong>Perícias</strong>
        <span data-summary="skills">0</span>
      </div>

      <div class="summary-item">
        <strong>Habilidades</strong>
        <span data-summary="abilities">0</span>
      </div>

      <div class="summary-item">
        <strong>Equipamentos</strong>
        <span data-summary="equipment">—</span>
      </div>

      <div class="summary-item">
        <strong>Estados</strong>
        <span data-summary="states">0</span>
      </div>

      <div class="summary-item">
        <strong>Campos</strong>
        <span data-summary="customFields">0</span>
      </div>

      <div class="summary-item">
        <strong>Dados</strong>
        <span data-summary="dice">0</span>
      </div>

    </div>


    <button
      type="button"
      id="edit-table-save"
      class="builder-primary-button"
    >
      💾 Salvar alterações
    </button>
  `;


  container.appendChild(
    section
  );


  const saveButton =
    section.querySelector(
      "#edit-table-save"
    );


  if (
    saveButton
  ) {

    saveButton.addEventListener(
      "click",
      () =>
        saveTable(
          saveButton
        )
    );
  }


  function update() {

    const values = {

      attributes:
        state.attributes.length,

      resources:
        state.resources.length,

      skills:
        state.skills.length,

      abilities:
        state.abilities.length,

      equipment:
        state.equipmentSettings.enabled ? "ON" : "OFF",

      states:
        state.states.length,

      customFields:
        state.customFields.length,

      dice:
        state.dice.length,

    };


    Object.entries(
      values
    ).forEach(
      ([key, value]) => {

        const element =
          section.querySelector(
            `[data-summary="${key}"]`
          );

        if (
          element
        ) {

          element.textContent =
            value;
        }
      }
    );
  }


  // Atualiza apenas enquanto a seção estiver conectada.
  const interval =
    setInterval(
      () => {

        if (
          !section.isConnected
        ) {

          clearInterval(
            interval
          );

          return;
        }

        update();

      },
      300
    );


  update();
}


// ============================================================
// ESTILOS ESPECÍFICOS DA VIEW
// ============================================================

function injectStyles() {

  if (
    document.getElementById(
      "create-table-styles"
    )
  ) {
    return;
  }


  const style =
    document.createElement("style");

  style.id =
    "create-table-styles";


  style.textContent = `

    /* ======================================================
       CONTAINER
       ====================================================== */

    .create-table-view {
      width: 100%;
      min-height: 100%;
      padding: 1rem;
      color: var(--text-primary);
    }

    .create-table-inner {
      width: 100%;
      max-width: 900px;
      margin: 0 auto;
    }


    /* ======================================================
       TOPO
       ====================================================== */

    .create-table-title {
      margin-bottom: 1.5rem;
    }

    .create-table-title h1 {
      margin: 0 0 .4rem;
      color: var(--accent-purple);
      font-size: 2rem;
      font-weight: 800;
    }

    .create-table-title p {
      color: var(--text-secondary);
      margin: 0;
    }


    /* ======================================================
       SEÇÕES
       ====================================================== */

    .builder-section {
      position: relative;
      background: var(--bg-card);
      border: 1px solid var(--border-color);
      border-radius: 14px;
      margin-bottom: 1rem;
      overflow: visible;
      box-shadow:
        0 4px 18px rgba(0,0,0,.06);
    }

    .builder-section-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 1rem;
      padding: 1rem;
      cursor: pointer;
      background: var(--bg-secondary);
      border-radius: 13px 13px 0 0;
    }

    .builder-section-title-area {
      display: flex;
      align-items: center;
      gap: .8rem;
      min-width: 0;
    }

    .builder-section-icon {
      font-size: 1.5rem;
      flex-shrink: 0;
    }

    .builder-section-header h2 {
      border: 0;
      padding: 0;
      margin: 0;
      font-size: 1.15rem;
    }

    .builder-section-header p {
      margin: .15rem 0 0;
      color: var(--text-secondary);
      font-size: .85rem;
    }

    .builder-section-actions {
      display: flex;
      align-items: center;
      gap: .5rem;
      flex-shrink: 0;
    }

    .builder-section-arrow {
      display: flex;
      width: 24px;
      height: 24px;
      align-items: center;
      justify-content: center;
      transition:
        transform .25s ease;
    }

    .builder-section-arrow .ui-chevron {
      width: 20px;
      height: 20px;
    }

    .builder-section.collapsed
      .builder-section-arrow {
      transform:
        rotate(-90deg);
    }

    .builder-section-content {
      padding: 1rem;
    }

    .builder-section.collapsed
      .builder-section-content {
      display: none;
    }


    /* ======================================================
       CAMPOS
       ====================================================== */

    .create-field {
      position: relative;
      margin-bottom: 1rem;
    }

    .create-field-label {
      display: flex;
      align-items: center;
      gap: .4rem;
      margin-bottom: .4rem;
    }

    .create-field-label label {
      margin: 0;
      color: var(--text-primary);
      font-size: .9rem;
      font-weight: 650;
    }


    /* ======================================================
       INPUTS
       ====================================================== */

    .builder-input {
      width: 100%;
      min-height: 44px;
      box-sizing: border-box;

      padding:
        .7rem .85rem;

      border:
        1px solid var(--border-color);

      border-radius:
        10px;

      background:
        var(--bg-secondary);

      color:
        var(--text-primary);

      outline:
        none;

      font:
        inherit;

      transition:
        border-color .2s ease,
        box-shadow .2s ease,
        background .2s ease;
    }

    .builder-input::placeholder {
      color:
        var(--text-secondary);

      opacity:
        .65;
    }

    .builder-input:hover {
      border-color:
        color-mix(
          in srgb,
          var(--accent-purple) 45%,
          var(--border-color)
        );
    }

    .builder-input:focus {
      border-color:
        var(--accent-purple);

      box-shadow:
        0 0 0 3px
        rgba(107,33,168,.12);

      background:
        var(--bg-card);
    }

    .builder-textarea {
      min-height: 110px;
      resize: vertical;
      line-height: 1.55;
    }

    .builder-inline-note {
      display: flex;
      flex-direction: column;
      gap: .2rem;
      margin-top: .2rem;
      padding: .8rem .9rem;
      border: 1px solid var(--border-color);
      border-radius: 10px;
      background: var(--bg-secondary);
      color: var(--text-secondary);
      font-size: .84rem;
      line-height: 1.5;
    }

    .builder-inline-note strong {
      color: var(--text-primary);
      font-size: .86rem;
    }


    /* ======================================================
       DROPDOWN CUSTOMIZADO
       ====================================================== */

    .custom-select {
      position: relative;
      width: 100%;
      outline: none;
    }

    .custom-select-trigger {
      width: 100%;
      min-height: 44px;

      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: .8rem;

      padding:
        .7rem .85rem;

      border:
        1px solid var(--border-color);

      border-radius:
        10px;

      background:
        var(--bg-secondary);

      color:
        var(--text-primary);

      cursor:
        pointer;

      font:
        inherit;

      text-align:
        left;

      transition:
        border-color .2s ease,
        box-shadow .2s ease,
        background .2s ease;
    }

    .custom-select-trigger:hover {
      border-color:
        var(--accent-purple);
    }

    .custom-select:focus
      .custom-select-trigger {
      border-color:
        var(--accent-purple);

      box-shadow:
        0 0 0 3px
        rgba(107,33,168,.12);
    }

    .custom-select-label {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .custom-select-arrow {
      display: flex;
      width: 22px;
      height: 22px;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
      color: var(--text-secondary);
    }

    .custom-select-arrow .ui-chevron {
      width: 18px;
      height: 18px;
      transition:
        transform .2s ease;
    }

    .custom-select-menu {
      position: fixed;
      z-index: 100000;

      max-height:
        min(320px, 45vh);

      overflow-y:
        auto;

      padding:
        .35rem;

      border:
        1px solid var(--border-color);

      border-radius:
        11px;

      background:
        #18181f !important;

      background-color:
        #18181f !important;

      color:
        #f5f5f7;

      box-shadow:
        0 16px 45px rgba(0,0,0,.35);

      animation:
        dropdownIn .14s ease;
    }

    @keyframes dropdownIn {

      from {
        opacity: 0;
        transform: translateY(-4px);
      }

      to {
        opacity: 1;
        transform: translateY(0);
      }
    }

    .custom-select-option {
      width: 100%;

      display: flex;
      align-items: center;

      min-height: 40px;

      padding:
        .55rem .7rem;

      border:
        0;

      border-radius:
        8px;

      background:
        #18181f !important;

      background-color:
        #18181f !important;

      color:
        #f5f5f7;

      font:
        inherit;

      text-align:
        left;

      cursor:
        pointer;
    }

    .custom-select-option:hover {
      background:
        #252531 !important;

      color:
        var(--accent-purple);
    }

    .custom-select-option.selected {
      background:
        rgba(107,33,168,.12);

      color:
        var(--accent-purple);

      font-weight:
        700;
    }


    /* ======================================================
       HELP
       ====================================================== */

    .help-button {
      width: 22px;
      height: 22px;
      min-width: 22px;
      padding: 0;

      border-radius:
        50%;

      background:
        var(--accent-purple);

      color:
        white;

      font-size:
        .75rem;

      font-weight:
        800;
    }

    .help-button:hover {
      background:
        var(--accent-purple-hover);
    }

    .help-modal {
      position: fixed;
      inset: 0;
      z-index: 99999;

      display: flex;
      align-items: center;
      justify-content: center;

      padding:
        1rem;
    }

    .help-modal-backdrop {
      position: absolute;
      inset: 0;
      background:
        rgba(0,0,0,.65);
    }

    .help-modal-card {
      position: relative;

      width: 100%;
      max-width: 520px;
      max-height: 85vh;

      overflow: auto;

      background:
        #2a1812;

      color:
        var(--text-primary);

      border:
        1px solid var(--border-color);

      border-radius:
        14px;

      box-shadow:
        0 15px 50px rgba(0,0,0,.35);

      z-index: 1;
    }

    .help-modal-header {
      display: flex;
      justify-content: space-between;
      align-items: center;

      padding:
        1rem;

      background:
        #3a2118;

      border-bottom:
        1px solid var(--border-color);
    }

    .help-modal-header h3 {
      margin: 0;
      color:
        var(--accent-purple);
    }

    .help-modal-close {
      width: 34px;
      height: 34px;
      padding: 0;

      border-radius:
        50%;

      font-size:
        1.3rem;
    }

    .help-modal-content {
      padding:
        1.2rem;

      line-height:
        1.7;
    }


    /* ======================================================
       CARDS
       ====================================================== */

    .builder-list {
      display: flex;
      flex-direction: column;
      gap: .7rem;
      margin-bottom: 1rem;
    }

    .builder-card {
      position: relative;

      border:
        1px solid var(--border-color);

      border-radius:
        10px;

      background:
        var(--bg-primary);

      overflow:
        visible;
    }

    .builder-card-header {
      min-height: 58px;

      display: flex;
      align-items: center;
      justify-content: space-between;

      gap: .7rem;

      padding:
        .7rem .8rem;

      cursor:
        pointer;

      border-radius:
        9px;
    }

    .builder-card-information {
      display: flex;
      align-items: center;
      gap: .7rem;
      min-width: 0;
    }

    .builder-card-icon {
      font-size:
        1.25rem;

      flex-shrink:
        0;
    }

    .builder-card-text {
      min-width:
        0;
    }

    .builder-card-title {
      font-weight:
        700;

      overflow:
        hidden;

      text-overflow:
        ellipsis;

      white-space:
        nowrap;
    }

    .builder-card-subtitle {
      color:
        var(--text-secondary);

      font-size:
        .78rem;

      margin-top:
        .1rem;
    }

    .builder-card-actions {
      display: flex;
      align-items: center;
      gap: .4rem;
      flex-shrink: 0;
    }

    .builder-card-arrow {
      display: flex;
      align-items: center;
      justify-content: center;

      width:
        26px;

      height:
        26px;

      color:
        var(--text-secondary);

      transition:
        transform .25s ease;
    }

    .builder-card-arrow .ui-chevron {
      width:
        19px;

      height:
        19px;
    }

    .builder-card.expanded
      .builder-card-arrow {
      transform:
        rotate(180deg);
    }

    .builder-card-body {
      display: none;

      padding:
        1rem;

      border-top:
        1px solid var(--border-color);

      background:
        var(--bg-card);

      border-radius:
        0 0 9px 9px;
    }

    .builder-card.expanded
      .builder-card-body {
      display:
        block;
    }

    .builder-remove-button {
      width:
        32px;

      height:
        32px;

      padding:
        .45rem;

      display:
        flex;

      align-items:
        center;

      justify-content:
        center;

      border-radius:
        8px;

      background:
        transparent;

      color:
        var(--accent-red);
    }

    .builder-remove-button svg {
      width:
        18px;

      height:
        18px;
    }

    .builder-remove-button:hover {
      background:
        rgba(180,0,0,.1);
    }


    /* ======================================================
       BOTÃO ADICIONAR
       ====================================================== */

    .builder-add-button {
      width: 100%;

      min-height:
        44px;

      display:
        flex;

      align-items:
        center;

      justify-content:
        center;

      gap:
        .45rem;

      background:
        transparent;

      color:
        var(--accent-purple);

      border:
        1px dashed var(--accent-purple);

      border-radius:
        10px;

      font-weight:
        700;
    }

    .builder-add-button:hover {
      background:
        rgba(107,33,168,.07);
    }

    .builder-add-icon {
      font-size:
        1.25rem;

      line-height:
        1;
    }


    /* ======================================================
       AVANÇADO
       ====================================================== */

    .advanced-options {
      margin-top:
        1rem;

      border:
        1px solid var(--border-color);

      border-radius:
        10px;

      overflow:
        hidden;
    }

    .advanced-options summary {
      display:
        flex;

      align-items:
        center;

      justify-content:
        space-between;

      padding:
        .8rem;

      cursor:
        pointer;

      font-weight:
        700;

      color:
        var(--accent-purple);

      background:
        var(--bg-secondary);

      list-style:
        none;
    }

    .advanced-options summary::-webkit-details-marker {
      display:
        none;
    }

    .advanced-options summary .ui-chevron {
      width:
        18px;

      height:
        18px;

      transition:
        transform .2s ease;
    }

    .advanced-options[open]
      summary .ui-chevron {
      transform:
        rotate(180deg);
    }

    .advanced-content {
      padding:
        .8rem;
    }

    .checkbox-field {
      display:
        flex;

      align-items:
        center;

      gap:
        .6rem;

      padding:
        .5rem 0;

      color:
        var(--text-primary);

      cursor:
        pointer;
    }

    .checkbox-field input {
      appearance: none;
      -webkit-appearance: none;
      width: 20px;
      height: 20px;
      min-width: 20px;
      margin: 0;
      padding: 0;
      border: 1.5px solid var(--border-color);
      border-radius: 6px;
      background: var(--bg-secondary);
      display: inline-grid;
      place-content: center;
      cursor: pointer;
      transition: background .18s ease, border-color .18s ease, transform .12s ease, box-shadow .18s ease;
    }

    .checkbox-field input::before {
      content: "";
      width: 10px;
      height: 5px;
      border-left: 2px solid transparent;
      border-bottom: 2px solid transparent;
      transform: rotate(-45deg) scale(0);
      transition: transform .15s ease, border-color .15s ease;
    }

    .checkbox-field input:checked {
      background: var(--accent-purple);
      border-color: var(--accent-purple);
      box-shadow: 0 3px 10px rgba(0,0,0,.14);
    }

    .checkbox-field input:checked::before {
      border-left-color: #fff;
      border-bottom-color: #fff;
      transform: rotate(-45deg) scale(1);
    }

    .system-config-block .help-button { margin-left: auto; flex: 0 0 auto; }

    .checkbox-field input:active {
      transform: scale(.92);
    }

    .equipment-setting-toggle,
    .finance-setting-toggle {
      min-height: 58px;
      padding: .8rem .9rem;
      border: 1px solid var(--border-color);
      border-radius: 12px;
      background: var(--bg-card);
      box-sizing: border-box;
      transition: background .18s ease, border-color .18s ease;
    }

    .equipment-setting-toggle:hover,
    .finance-setting-toggle:hover {
      background: var(--bg-secondary);
    }

    .equipment-setting-toggle input,
    .finance-setting-toggle input {
      width: 22px;
      height: 22px;
      min-width: 22px;
      border-radius: 7px;
    }


    /* ======================================================
       DADOS
       ====================================================== */

    .dice-builder-grid {
      display:
        grid;

      grid-template-columns:
        repeat(4, 1fr);

      gap:
        .75rem;
    }

    .dice-builder-option {
      min-height:
        125px;

      display:
        flex;

      flex-direction:
        column;

      align-items:
        center;

      justify-content:
        center;

      gap:
        .55rem;

      padding:
        .75rem;

      background:
        var(--bg-secondary);

      color:
        var(--text-primary);

      border:
        2px solid var(--border-color);

      border-radius:
        12px;

      cursor:
        pointer;

      transition:
        transform .18s ease,
        border-color .18s ease,
        background .18s ease,
        box-shadow .18s ease;
    }

    .dice-builder-option:hover {
      transform:
        translateY(-2px);

      border-color:
        var(--text-secondary);
    }

    .dice-builder-option.selected {
      transform:
        translateY(-2px);

      box-shadow:
        0 8px 24px rgba(0,0,0,.12);
    }

    .dice-visual {
      width:
        68px;

      height:
        68px;

      display:
        flex;

      align-items:
        center;

      justify-content:
        center;
    }

    .dice-visual svg {
      width:
        100%;

      height:
        100%;

      max-width:
        68px;

      max-height:
        68px;
    }

    .dice-label {
      font-size:
        .95rem;

      font-weight:
        800;

      letter-spacing:
        .02em;
    }


    /* ======================================================
       CORES DOS DADOS
       ====================================================== */

    .dice-d2.selected {
      border-color:
        #facc15;

      color:
        #facc15;

      background:
        rgba(250,204,21,.12);
    }

    .dice-d4.selected {
      border-color:
        #3b82f6;

      color:
        #3b82f6;

      background:
        rgba(59,130,246,.12);
    }

    .dice-d6.selected {
      border-color:
        #22c55e;

      color:
        #22c55e;

      background:
        rgba(34,197,94,.12);
    }

    .dice-d8.selected {
      border-color:
        #a855f7;

      color:
        #a855f7;

      background:
        rgba(168,85,247,.12);
    }

    .dice-d10.selected {
      border-color:
        #ec4899;

      color:
        #ec4899;

      background:
        rgba(236,72,153,.12);
    }

    .dice-d12.selected {
      border-color:
        #f97316;

      color:
        #f97316;

      background:
        rgba(249,115,22,.12);
    }

    .dice-d20.selected {
      border-color:
        #ef4444;

      color:
        #ef4444;

      background:
        rgba(239,68,68,.12);
    }

    .dice-d100.selected {
      border-color:
        #06b6d4;

      color:
        #06b6d4;

      background:
        rgba(6,182,212,.12);
    }


    /* ======================================================
       D100
       ====================================================== */

    .dice-d100-double {
      width: 74px;
      height: 58px;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 5px;
      overflow: visible;
    }

    .dice-d100-part {
      position: relative;
      flex: 0 0 32px;
      width: 32px;
      height: 32px;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .dice-d100-part:first-child {
      transform: rotate(-5deg);
    }

    .dice-d100-part:last-child {
      transform: rotate(5deg);
    }

    .dice-d100-part svg {
      width:
        100%;

      height:
        100%;
    }


    .system-config-block {
      margin-top: .8rem;
      padding: .9rem;
      border: 1px solid var(--border-color);
      border-radius: 14px;
      background: var(--bg-primary);
      box-sizing: border-box;
    }

    .system-config-block + .system-config-block {
      margin-top: 1rem;
    }

    .equipment-system-block,
    .finance-system-block {
      display: flex;
      flex-direction: column;
      gap: .7rem;
    }

    .equipment-config-content {
      display: flex;
      flex-direction: column;
      gap: .25rem;
      margin-top: .8rem;
      transition: opacity .2s ease;
    }

    .equipment-config-content.is-disabled {
      opacity: .48;
      pointer-events: none;
    }

    .equipment-setting-toggle span,
    .equipment-config-content .checkbox-field span {
      display: flex;
      flex-direction: column;
      gap: .15rem;
    }

    .equipment-setting-toggle small,
    .equipment-config-content small {
      color: var(--text-secondary);
      font-size: .8rem;
      font-weight: 400;
    }

    .equipment-config-list {
      margin-top: .45rem;
      padding: .85rem;
      border: 1px solid var(--border-color);
      border-radius: 10px;
      background: var(--bg-secondary);
    }

    .equipment-config-items {
      display: flex;
      flex-wrap: wrap;
      gap: .45rem;
      margin-top: .65rem;
    }

    .equipment-config-item {
      display: flex;
      align-items: center;
      gap: .35rem;
      padding: .35rem .5rem .35rem .65rem;
      border: 1px solid var(--border-color);
      border-radius: 999px;
      background: var(--bg-card);
    }

    .equipment-config-item button {
      width: 24px;
      height: 24px;
      padding: 0;
      border-radius: 50%;
      background: transparent;
      color: var(--text-secondary);
      font-size: 1.1rem;
      line-height: 1;
    }

    .equipment-config-item button:hover {
      background: rgba(180,0,0,.1);
      color: var(--accent-red);
    }


    /* ======================================================
       NOTAS
       ====================================================== */

    .builder-note {
      margin-top:
        1rem;

      padding:
        .9rem 1rem;

      border-left:
        3px solid var(--accent-purple);

      background:
        var(--bg-secondary);

      border-radius:
        7px;

      color:
        var(--text-secondary);
    }

    .builder-note strong {
      color:
        var(--text-primary);
    }

    .builder-note p {
      margin:
        .25rem 0 0;
    }


    /* ======================================================
       AMIGOS
       ====================================================== */

    .friends-builder-list {
      display:
        flex;

      flex-direction:
        column;

      gap:
        .4rem;

      margin-top:
        .5rem;
    }

    .create-table-header {
      display: flex;
      align-items: center;
      min-height: 42px;
      gap: .75rem;
      margin-bottom: 1rem;
    }

    .create-table-back-button {
      width: 42px;
      height: 42px;
      min-width: 42px;
      min-height: 42px;
      padding: 0;
      margin: 0;
      box-sizing: border-box;
      border: 1px solid var(--border-color);
      border-radius: 50%;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      flex: 0 0 42px;
      overflow: hidden;
      background: var(--bg-card);
      color: var(--text-main);
      cursor: pointer;
      transition: background .18s ease, transform .18s ease, border-color .18s ease;
    }

    .create-table-back-button:hover {
      background: var(--bg-secondary);
      transform: translateX(-2px);
    }

    .create-table-back-button svg {
      display: block;
      width: 20px;
      height: 20px;
      min-width: 20px;
      min-height: 20px;
      flex: 0 0 20px;
      margin: 0;
      overflow: visible;
    }

    .system-config-subtitle {
      margin: .15rem 0 .15rem;
      font-size: .82rem;
      font-weight: 800;
      color: var(--text-secondary);
      text-transform: uppercase;
      letter-spacing: .06em;
    }

    .finance-config-content {
      display: flex;
      flex-direction: column;
      gap: .25rem;
      margin-top: .8rem;
      transition: opacity .2s ease;
    }

    .finance-config-content.is-disabled {
      opacity: .48;
      pointer-events: none;
    }

    .finance-setting-toggle span,
    .finance-config-content .checkbox-field span {
      display: flex;
      flex-direction: column;
      gap: .15rem;
    }

    .finance-setting-toggle small,
    .finance-config-content small {
      color: var(--text-secondary);
      font-size: .8rem;
      font-weight: 400;
    }


    .create-table-back {
      width: 42px;
      height: 42px;
      min-width: 42px;
      min-height: 42px;
      padding: 0;
      margin: 0;
      box-sizing: border-box;
      border: 1px solid var(--border-color);
      border-radius: 50%;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      flex: 0 0 42px;
      overflow: hidden;
      background: var(--bg-card);
      color: var(--text-main);
      cursor: pointer;
      transition: background .18s ease, transform .18s ease, border-color .18s ease;
    }

    .create-table-back:hover {
      background: var(--bg-secondary);
      transform: translateX(-2px);
    }

    .create-table-back svg {
      display: block !important;
      width: 20px;
      height: 20px;
      min-width: 20px;
      min-height: 20px;
      flex: 0 0 20px;
      margin: 0;
      overflow: visible;
    }

    .friend-builder-item {
      display:
        flex;

      align-items:
        center;

      gap:
        .7rem;

      padding:
        .7rem;

      border:
        1px solid var(--border-color);

      border-radius:
        9px;

      background:
        var(--bg-primary);

      cursor:
        pointer;
    }

    .friend-builder-item:hover {
      background:
        var(--bg-secondary);
    }

    .friend-builder-item input {
      position: absolute;
      opacity: 0;
      pointer-events: none;
    }

    .friend-builder-invite {
      margin-left: auto;
      width: 34px;
      height: 34px;
      min-width: 34px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      background: var(--bg-secondary);
      border: 1px solid var(--border-color);
      font-size: 1.05rem;
      line-height: 1;
      transition: transform .18s ease, background .18s ease, border-color .18s ease;
    }

    .friend-builder-item:hover .friend-builder-invite {
      transform: scale(1.05);
    }

    .friend-builder-item.invited .friend-builder-invite {
      background: rgba(180, 0, 0, .10);
      border-color: var(--accent-red);
    }

    .friend-builder-avatar {
      width: 36px;
      height: 36px;
      min-width: 36px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      overflow: hidden;
      background: var(--accent-purple);
      color: white;
      font-weight: 800;
    }

    .friend-builder-avatar img {
      width: 100%;
      height: 100%;
      display: block;
      object-fit: cover;
    }

    .friends-selected-counter {
      margin-top:
        .8rem;

      text-align:
        center;

      color:
        var(--text-secondary);

      font-size:
        .85rem;
    }

    .builder-empty {
      text-align:
        center;

      padding:
        1.5rem;

      color:
        var(--text-secondary);
    }


    /* ======================================================
       RESUMO
       ====================================================== */

    .builder-summary {
      background:
        var(--bg-card);

      border:
        1px solid var(--border-color);

      border-radius:
        14px;

      padding:
        1rem;

      margin-bottom:
        2rem;

      box-shadow:
        0 4px 18px rgba(0,0,0,.06);
    }

    .builder-summary-header {
      display:
        flex;

      justify-content:
        space-between;

      align-items:
        center;

      margin-bottom:
        1rem;
    }

    .builder-summary-header h2 {
      border:
        0;

      padding:
        0;

      margin:
        0;
    }

    .builder-summary-header p {
      margin:
        .2rem 0 0;

      color:
        var(--text-secondary);
    }

    .builder-summary-icon {
      font-size:
        2rem;
    }

    .builder-summary-grid {
      display:
        grid;

      grid-template-columns:
        repeat(auto-fit, minmax(120px, 1fr));

      gap:
        .6rem;

      margin-bottom:
        1rem;
    }

    .summary-item {
      padding:
        .8rem;

      border-radius:
        8px;

      background:
        var(--bg-secondary);

      display:
        flex;

      flex-direction:
        column;

      gap:
        .15rem;
    }

    .summary-item span {
      color:
        var(--accent-purple);

      font-weight:
        800;

      font-size:
        1.2rem;
    }

    .builder-primary-button {
      width:
        100%;

      min-height:
        52px;

      font-size:
        1rem;

      font-weight:
        800;

      background:
        var(--accent-red);

      border-radius:
        10px;
    }

    .builder-primary-button:hover {
      background:
        var(--accent-red-hover);
    }

    .builder-primary-button:disabled {
      opacity:
        .6;

      cursor:
        wait;
    }


    /* ======================================================
       MENSAGENS
       ====================================================== */

    .create-table-message {
      position:
        fixed;

      left:
        50%;

      bottom:
        1.5rem;

      transform:
        translate(-50%, 120px);

      z-index:
        10000;

      max-width:
        calc(100% - 2rem);

      padding:
        .9rem 1.2rem;

      border-radius:
        10px;

      background:
        var(--bg-card);

      color:
        var(--text-primary);

      border:
        1px solid var(--border-color);

      box-shadow:
        0 8px 30px rgba(0,0,0,.2);

      transition:
        transform .3s ease;
    }

    .create-table-message.visible {
      transform:
        translate(-50%, 0);
    }

    .create-table-message.error {
      border-color:
        var(--accent-red);
    }

    .create-table-message.success {
      border-color:
        var(--accent-purple);
    }


    /* ======================================================
       SVG
       ====================================================== */

    .ui-chevron {
      display:
        block;

      width:
        24px;

      height:
        24px;
    }


    /* ======================================================
       MOBILE
       ====================================================== */

    @media (max-width: 700px) {

      .dice-builder-grid {
        grid-template-columns:
          repeat(4, 1fr);
      }

      .dice-builder-option {
        min-height:
          110px;
      }

      .dice-visual {
        width:
          58px;

        height:
          58px;
      }

      .dice-d100-double {
        transform: scale(.82);
      }
    }


    @media (max-width: 500px) {

      .create-table-view {
        padding:
          .6rem;
      }

      .create-table-title h1 {
        font-size:
          1.6rem;
      }

      .builder-section-content {
        padding:
          .8rem;
      }

      .builder-card-body {
        padding:
          .8rem;
      }

      .builder-section-header {
        padding:
          .8rem;
      }

      .dice-builder-grid {
        grid-template-columns:
          repeat(2, 1fr);
      }

      .dice-builder-option {
        min-height:
          125px;
      }
    }

  `;


  document.head.appendChild(
    style
  );
}


// ============================================================
// RENDER PRINCIPAL
// ============================================================

async function renderEditTable() {

  injectStyles();


  if (
    !state.currentUser ||
    !state.editTableId
  ) {
    showMessage(
      "Não foi possível identificar a mesa.",
      "error"
    );
    return;
  }


  const tableSnap =
    await getDoc(
      doc(
        db,
        "tables",
        state.editTableId
      )
    );


  if (!tableSnap.exists()) {
    showMessage(
      "Mesa não encontrada.",
      "error"
    );

    setTimeout(() => {
      window.router?.navigate("/home");
    }, 700);

    return;
  }


  const table =
    tableSnap.data();


  if (
    table.ownerId !==
    state.currentUser.uid
  ) {
    showMessage(
      "Apenas o mestre pode editar esta mesa.",
      "error"
    );

    setTimeout(() => {
      window.history.back();
    }, 700);

    return;
  }


  const cfg =
    table.configuration || {};


  state.identity.name =
    table.name || "";

  state.identity.description =
    table.description || "";

  state.attributes =
    Array.isArray(cfg.attributes)
      ? structuredClone(cfg.attributes)
      : [];

  state.resources =
    Array.isArray(cfg.resources)
      ? structuredClone(cfg.resources)
      : [];

  state.skills =
    Array.isArray(cfg.skills)
      ? structuredClone(cfg.skills)
      : [];

  state.abilities =
    Array.isArray(cfg.abilities)
      ? structuredClone(cfg.abilities)
      : [];

  // Normaliza a configuração de equipamentos para que mesas
  // antigas/incompletas nunca deixem listas como undefined.
  const loadedEquipmentSettings =
    cfg.equipmentSettings && typeof cfg.equipmentSettings === "object"
      ? cfg.equipmentSettings
      : (cfg.equipment && typeof cfg.equipment === "object"
          ? cfg.equipment
          : {});

  state.equipmentSettings = {
    enabled: false,
    financeEnabled: false,
    equipmentTypes: [],
    currencyTypes: [],
    loadSystem: "",
    loadUnit: "",
    slotCount: "",
    maxItemsPerSlot: "",
    weightLimit: "",
    weightUnit: "",
    unitMax: "",
    customEquipmentName: "",
    customEquipmentMax: "",
    ...structuredClone(loadedEquipmentSettings)
  };

  state.equipmentSettings.equipmentTypes =
    Array.isArray(state.equipmentSettings.equipmentTypes)
      ? state.equipmentSettings.equipmentTypes
      : [];

  state.equipmentSettings.currencyTypes =
    Array.isArray(state.equipmentSettings.currencyTypes)
      ? state.equipmentSettings.currencyTypes
      : [];

  state.states =
    Array.isArray(cfg.states)
      ? structuredClone(cfg.states)
      : [];

  state.customFields =
    Array.isArray(cfg.customFields)
      ? structuredClone(cfg.customFields)
      : [];

  // Garante compatibilidade com mesas antigas que ainda não possuem options.
  state.customFields.forEach(field => {
    if (!Array.isArray(field.options)) {
      field.options = [];
    }
  });

  state.dice =
    Array.isArray(cfg.dice)
      ? structuredClone(cfg.dice)
      : [];

  state.existingMembers =
    Array.isArray(table.members)
      ? [...table.members]
      : [state.currentUser.uid];

  state.existingSettings =
    table.settings && typeof table.settings === "object"
      ? structuredClone(table.settings)
      : {};

  state.existingCreatedAt =
    table.createdAt || null;


  const app =
    document.getElementById(
      "app"
    );


  if (!app) {
    console.error(
      "Elemento #app não encontrado."
    );
    return;
  }


  app.innerHTML =
    "";


  const view =
    document.createElement("div");

  view.className =
    "create-table-view";


  const inner =
    document.createElement("div");

  inner.className =
    "create-table-inner";


  const title =
    document.createElement("div");

  title.className =
    "create-table-title";

  title.innerHTML = `
    <div class="create-table-header">
      <button type="button" class="create-table-back" aria-label="Voltar">
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M15 5L8 12L15 19" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </button>
      <div>
        <h1>
          ⚔️ Editar mesa
        </h1>

        <p>
          Edite as configurações da sua mesa, mantendo toda a estrutura da aventura.
        </p>
      </div>
    </div>
  `;

  title
    .querySelector(".create-table-back")
    .addEventListener("click", () => {
      if (window.router?.navigate) {
        window.router.navigate(
          `/game/${encodeURIComponent(state.editTableId)}`
        );
      } else {
        window.history.back();
      }
    });


  inner.appendChild(
    title
  );


  const builder =
    document.createElement("div");

  builder.className =
    "create-table-builder";


  inner.appendChild(
    builder
  );


  buildIdentity(builder);
  buildAttributes(builder);
  buildResources(builder);
  buildSkills(builder);
  buildAbilities(builder);
  buildEquipmentConfig(builder);
  buildStates(builder);
  buildCustomFields(builder);
  buildDice(builder);
  buildSummary(builder);


  view.appendChild(
    inner
  );

  app.appendChild(
    view
  );
}


// ============================================================
// AUTENTICAÇÃO
// ============================================================

let authListenerStarted =
  false;


function ensureAuthentication() {

  if (
    authListenerStarted
  ) {
    return;
  }


  authListenerStarted =
    true;


  onAuthStateChanged(
    auth,
    user => {

      state.currentUser =
        user;


      if (!user) {

        showMessage(
          "Você precisa estar logado para editar uma mesa.",
          "error"
        );

        return;
      }


      renderEditTable();
    }
  );
}


// ============================================================
// EXPORTAÇÃO
// ============================================================

export default function editTableView(params = {}) {

  state.editTableId =
    params.tableId ||
    params.id ||
    null;

  ensureAuthentication();
}
