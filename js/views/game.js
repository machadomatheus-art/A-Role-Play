// ============================================================
// ROLEPLAY — CHAT DA MESA
// ============================================================
// Tela principal de gameplay.
// Estrutura esperada no Firestore:
//   tables/{tableId}
//   tables/{tableId}/messages/{messageId}
//   tables/{tableId}/members/{uid}      (opcional; o documento da mesa
//                                        continua sendo a fonte principal)
//   tables/{tableId}/characters/{uid}   (usado para verificar ficha)
//
// A view foi feita para continuar funcionando mesmo antes de
// character-sheet.js estar pronto: o botão Ficha navega para a rota
// da ficha quando ela existir.
// ============================================================

import { auth, db } from "../firebase-config.js";
import { sendARolePlayPush } from "../notification.js";

import {
  collection,
  query,
  orderBy,
  onSnapshot,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  getDocs,
  writeBatch,
  arrayUnion,
  arrayRemove,
  increment,
  runTransaction,
  serverTimestamp,
  limit
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

import {
  renderSVG_D2,
  renderSVG_D4,
  renderSVG_D6,
  renderSVG_D8,
  renderSVG_D10,
  renderSVG_D12,
  renderSVG_D20
} from "./common/dice.js";

const state = {
  tableId: null,
  table: null,
  user: null,
  members: [],
  messages: [],
  unsubscribeMessages: null,
  unsubscribeTable: null,
  unsubscribeMembers: null,
  mutedByTable: false,
  isMaster: false,
  quickOpen: false,
  sending: false,
  imageBusy: false,
  selectedMember: null,
  rollCharacter: {},
  rollDeclarations: [],
  rollSubmitting: false,
  activeParserCodes: [],
  modalBack: null,
  typingUsers: {},
  typingTimer: null,
  longPressTimer: null,
  unsubscribeCharacterAccess: null
};

// ============================================================
// UTILITÁRIOS
// ============================================================

function esc(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function initials(name = "Usuário") {
  const parts = String(name).trim().split(/\s+/).filter(Boolean);
  return (parts.slice(0, 2).map(p => p[0]).join("") || "U").toUpperCase();
}

function navigate(path) {
  if (window.router && typeof window.router.navigate === "function") {
    window.router.navigate(path);
  } else {
    window.history.pushState({}, "", path);
    window.dispatchEvent(new PopStateEvent("popstate"));
  }
}

function toast(message, type = "info") {
  const old = document.querySelector(".rp-toast");
  old?.remove();
  const el = document.createElement("div");
  el.className = `rp-toast rp-toast-${type}`;
  el.textContent = message;
  document.body.appendChild(el);
  requestAnimationFrame(() => el.classList.add("show"));
  setTimeout(() => {
    el.classList.remove("show");
    setTimeout(() => el.remove(), 220);
  }, 2600);
}

function svgIcon(name, cls = "") {
  const icons = {
    back: `<svg class="${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 18l-6-6 6-6"/></svg>`,
    clip: `<svg class="${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21.44 11.05l-8.49 8.49a5.5 5.5 0 0 1-7.78-7.78l9.2-9.2a3.5 3.5 0 0 1 4.95 4.95l-9.2 9.2a1.5 1.5 0 0 1-2.12-2.12l8.49-8.49"/></svg>`,
    send: `<svg class="${cls}" viewBox="0 0 24 24" fill="currentColor"><path d="M21.7 3.3a1 1 0 0 0-1.03-.24L3.1 9.52a1 1 0 0 0 .03 1.88l7.04 2.35 2.35 7.04a1 1 0 0 0 .94.68h.03a1 1 0 0 0 .91-.62l6.46-17.57a1 1 0 0 0-.16-.98ZM12.9 18.02l-1.68-5.04 5.45-5.45-6.04 4.17-4.52-1.51 13.31-4.9-6.52 12.73Z"/></svg>`,
    paper: `<svg class="${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5v14M5 12h14"/></svg>`,
    more: `<svg class="${cls}" viewBox="0 0 24 24" fill="currentColor"><circle cx="5" cy="12" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="19" cy="12" r="1.6"/></svg>`,
    settings: `<svg class="${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M9.6 3.6h4.8l.7 2.35c.47.2.91.45 1.32.76l2.38-.45 2.4 4.16-1.68 1.73c.04.28.06.56.06.85s-.02.57-.06.85l1.68 1.73-2.4 4.16-2.38-.45c-.41.31-.85.56-1.32.76l-.7 2.35H9.6l-.7-2.35a8 8 0 0 1-1.32-.76l-2.38.45-2.4-4.16 1.68-1.73a6.6 6.6 0 0 1 0-1.7L2.8 10.42l2.4-4.16 2.38.45c.41-.31.85-.56 1.32-.76L9.6 3.6Z"/><circle cx="12" cy="13" r="2.9"/></svg>`,
    trash: `<svg class="${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7h16M9 7V4h6v3m-9 0 1 13h10l1-13M10 11v6m4-6v6"/></svg>`,
    exit: `<svg class="${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M14 5H6a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h8"/><path d="m13 8 4 4-4 4M17 12H8"/></svg>`,
    table: `<svg class="${cls}" viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M7 13L17 9L31 13L41 9V35L31 39L17 35L7 39V13Z"/><path d="M17 9V35"/><path d="M31 13V39"/><circle cx="24" cy="23" r="4"/><path d="M24 19V27"/><path d="M20 23H28"/></svg>`, 
    crown: `<svg class="${cls}" viewBox="0 0 24 24" fill="currentColor"><path d="M4 18h16l1-9-5 3-4-7-4 7-5-3 1 9Zm1.2 2h13.6a1 1 0 0 1 0 2H5.2a1 1 0 0 1 0-2Z"/></svg>`,
    mute: `<svg class="${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M11 5 6 9H3v6h3l5 4V5Z"/><path d="m17 9 4 4m0-4-4 4"/></svg>`,
    kick: `<svg class="${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M9 4h6v3H9zM5 8h14l-1 12H6L5 8Z"/><path d="M9 12v5m6-5v5"/></svg>`,
    users: `<svg class="${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2"/><circle cx="9.5" cy="7" r="4"/><path d="M17 11a4 4 0 0 0 0-8m4 18v-2a4 4 0 0 0-3-3.87"/></svg>`,
    check: `<svg class="${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m5 12 4 4L19 6"/></svg>`,
    close: `<svg class="${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="m6 6 12 12M18 6 6 18"/></svg>`,
    dice: `<span class="rp-d20-icon">${renderSVG_D20()}</span>`,
    turn: `<svg class="${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7h12"/><path d="m13 4 3 3-3 3"/><path d="M20 17H8"/><path d="m11 14-3 3 3 3"/></svg>`,
    sheet: `<svg class="${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M6 3h9l3 3v15H6z"/><path d="M15 3v4h4M9 12h6M9 16h6M9 8h2"/></svg>`
  };
  return icons[name] || "";
}

function formatTime(ts) {
  if (!ts) return "";
  const date = ts.toDate ? ts.toDate() : new Date(ts);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

function isMaster() {
  return state.table?.ownerId === state.user?.uid || state.table?.masterUid === state.user?.uid;
}

function memberName(uid) {
  if (uid === state.user?.uid) return state.user.displayName || "Você";
  return state.members.find(m => m.uid === uid)?.username || "Usuário";
}

function memberPhoto(uid) {
  if (uid === state.user?.uid) {
    return state.members.find(m => m.uid === uid)?.avatarDataUrl || state.user.avatarDataUrl || state.user.photoURL || "";
  }
  return state.members.find(m => m.uid === uid)?.avatarDataUrl || "";
}

function roleForMessage(message) {
  if (message.authorRole === "bot" || message.type === "bot") return "bot";
  if (message.authorRole === "master" || message.isMaster === true || message.senderRole === "master") return "master";
  return "player";
}

function normalizeParserCode(value = "") {
  return String(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]/g, "")
    .slice(0, 3)
    .toUpperCase();
}

function configuredAttributes() {
  const attrs = Array.isArray(state.table?.configuration?.attributes)
    ? state.table.configuration.attributes : [];
  return attrs.map((attr, index) => {
    const name = typeof attr === "string" ? attr : (attr?.name || attr?.label || "");
    const code = typeof attr === "string" ? normalizeParserCode(attr) : normalizeParserCode(attr?.code || name);
    return { id: attr?.id || `attribute_${index}`, name, code };
  }).filter(a => a.name && a.code);
}

function extractParserCodes(text = "") {
  const valid = new Set(configuredAttributes().map(a => a.code));
  const found = [];
  const re = /\/([a-zA-Z0-9]{1,3})/g;
  let m;
  while ((m = re.exec(text))) {
    const code = normalizeParserCode(m[1]);
    if (valid.has(code) && !found.includes(code)) found.push(code);
  }
  return found;
}

function stripParserCodes(text = "") {
  const valid = new Set(configuredAttributes().map(a => a.code));
  return String(text).replace(/\/([a-zA-Z0-9]{1,3})/g, (full, code) => {
    return valid.has(normalizeParserCode(code)) ? "" : full;
  }).replace(/[ \t]{2,}/g, " ").replace(/\s+([,.;!?])/g, "$1").trim();
}

function findComposerToken(text, cursor) {
  const before = text.slice(0, cursor);
  const match = before.match(/(?:^|[\s([\{,;:!?])([/@&$])([\p{L}\p{N}_-]*)$/u);
  if (!match) return null;
  return { prefix: match[1], query: match[2] || "", start: cursor - (match[2] || "").length - 1 };
}

function insertComposerSuggestion(root, value) {
  const input = root.querySelector("#rp-input");
  if (!input) return;
  const cursor = input.selectionStart ?? input.value.length;
  const token = findComposerToken(input.value, cursor);
  if (!token) return;
  const before = input.value.slice(0, token.start);
  const after = input.value.slice(cursor);
  input.value = `${before}${value} ${after}`;
  const pos = before.length + value.length + 1;
  input.focus(); input.setSelectionRange(pos, pos);
  autoGrow({ currentTarget: input });
  hideComposerAssist(root);
}

function hideComposerAssist(root) {
  const menu = root.querySelector("#rp-parser-menu");
  if (!menu) return;
  menu.hidden = true; menu.innerHTML = "";
}

function updateComposerAssist(root) {
  const input = root.querySelector("#rp-input");
  const menu = root.querySelector("#rp-parser-menu");
  if (!input || !menu) return;
  const token = findComposerToken(input.value, input.selectionStart ?? input.value.length);
  if (!token) return hideComposerAssist(root);

  let options = [];
  if (token.prefix === "/") {
    if (!state.isMaster || isFreeMode()) return hideComposerAssist(root);
    const q = normalizeParserCode(token.query);
    options = configuredAttributes().filter(a => !q || a.code.startsWith(q) || a.name.toLocaleLowerCase("pt-BR").includes(token.query.toLocaleLowerCase("pt-BR"))).slice(0,4)
      .map(a => ({ value:`/${a.code}`, title:`/${a.code}`, subtitle:`Restringir a ${a.name}`, kind:"parser" }));
  } else if (token.prefix === "&") {
    if (!state.isMaster) return hideComposerAssist(root);
    const commands = [
      { value:"&give{}", title:"&give{}", subtitle:"Entregar ou retirar item de um personagem", kind:"command" },
      { value:"&recover{}", title:"&recover{}", subtitle:"Recuperar ou retirar recurso", kind:"command" },
      { value:"&set{}", title:"&set{}", subtitle:"Aplicar ou remover um estado", kind:"command" }
    ];
    const q = token.query.toLocaleLowerCase("pt-BR");
    options = commands.filter(c => !q || c.value.toLocaleLowerCase("pt-BR").includes(q));
  } else if (token.prefix === "$") {
    const equipment = state.table?.configuration?.equipmentSettings || state.table?.configuration?.equipment || {};
    if (!equipment.financeEnabled) return hideComposerAssist(root);
    const currencies = Array.isArray(equipment.currencyTypes) ? equipment.currencyTypes : [];
    const qName = token.query.toLocaleLowerCase("pt-BR");
    options = currencies.filter(raw => {
      const label = typeof raw === "object" ? (raw.name || raw.label || raw.code) : raw;
      return !qName || String(label || "").toLocaleLowerCase("pt-BR").includes(qName);
    }).slice(0,4).map(raw => {
      const label = typeof raw === "object" ? (raw.name || raw.label || raw.code) : raw;
      return { value:`$${label}{}`, title:`$${label}{}`, subtitle:"Alterar moeda da ficha", kind:"command" };
    });
  } else {
    const q = token.query.toLocaleLowerCase("pt-BR");
    options = state.members.filter(m => m.uid !== state.user.uid).filter(m => {
      const name = String(m.username || m.displayName || "Usuário");
      return !q || name.toLocaleLowerCase("pt-BR").includes(q);
    }).slice(0,4).map(m => ({ value:`@${m.username || m.displayName || "Usuário"}`, title:`@${m.username || m.displayName || "Usuário"}`, subtitle:"Membro da mesa", kind:"mention" }));
  }
  if (!options.length) return hideComposerAssist(root);
  menu.innerHTML = options.map(o => `<button type="button" class="rp-parser-option rp-parser-option-${o.kind}" data-parser-value="${esc(o.value)}"><span>${esc(o.title)}</span><small>${esc(o.subtitle)}</small></button>`).join("");
  menu.hidden = false;
  menu.querySelectorAll("[data-parser-value]").forEach(btn => {
    btn.addEventListener("mousedown", e => e.preventDefault());
    btn.addEventListener("click", () => insertComposerSuggestion(root, btn.dataset.parserValue));
  });
}

function declarationAttributeCodes(item) {
  const attrs = configuredAttributes();
  const valid = new Set(attrs.map(a => a.code));
  const out = [];
  const addCode = value => {
    if (value == null) return;
    const code = normalizeParserCode(value);
    if (valid.has(code) && !out.includes(code)) out.push(code);
  };
  const add = value => {
    if (value == null) return;
    if (typeof value === "string") {
      const text = String(value);
      const bracket = /\[\s*([A-Za-zÀ-ÿ][A-Za-zÀ-ÿ0-9_]*)\s*(?:[+-]\s*!?|[+-]\s*\d+(?:[.,]\d+)?)?\s*\]/g;
      let m;
      while ((m = bracket.exec(text))) addCode(m[1]);
      const slash = /\/([A-Za-z0-9]{1,3})/g;
      while ((m = slash.exec(text))) addCode(m[1]);
      if (!out.length) addCode(text);
      return;
    }
    if (typeof value === "number") return;
    if (Array.isArray(value)) return value.forEach(add);
    if (typeof value === "object") {
      if (value.code || value.attribute || value.attributeCode || value.name) {
        addCode(value.code || value.attributeCode || value.attribute || value.name);
      }
      Object.entries(value).forEach(([key, val]) => {
        if (typeof val === "number" || (typeof val === "string" && /^[+-]?\d+(?:[.,]\d+)?$/.test(val.trim()))) addCode(key);
        else if (!/^(id|name|label|description|type|kind|category|value|current|amount|qty|quantity|cost)$/.test(key)) add(val);
      });
    }
  };
  [item?.attributeCodes, item?.attributes, item?.attributeIds, item?.affectedAttributes, item?.allowedAttributes,
    item?.modifiers, item?.bonuses, item?.attributeBonuses, item?.effects, item?.description, item?.formula].forEach(add);
  return out;
}

function declarationParserExpressions(item, includeCost = false) {
  const texts = [];
  const seen = new Set();
  const collect = value => {
    if (typeof value === "string") {
      if (value.includes("[") && value.includes("]")) texts.push(value);
      return;
    }
    if (!value || typeof value !== "object" || seen.has(value)) return;
    seen.add(value);
    if (Array.isArray(value)) { value.forEach(collect); return; }
    Object.entries(value).forEach(([key, val]) => {
      // Cost is a separate semantic channel. It must NEVER become an effect
      // when this function is collecting declaration effects. It is included
      // only through the explicit includeCost path below.
      if (/^costs?$/i.test(key)) {
        if (includeCost) collect(val);
        return;
      }
      // Never inspect identity/quantity fields as parser text, but ALWAYS inspect
      // descriptive fields. Equipment parsers commonly live in description.
      if (/^(id|name|label|title|type|kind|category|value|current|amount|qty|quantity)$/i.test(key)) return;
      collect(val);
    });
  };
  // Explicitly inspect the canonical descriptive fields first. This is important
  // because an equipment item may have no attribute metadata at all: [DES+3] in
  // its description is still a complete, valid parser declaration.
  [item?.description, item?.formula, item?.text, item?.effect, item?.effects,
   item?.modifiers, item?.bonuses, item?.attributeBonuses, item?.rules, item?.properties]
    .forEach(collect);
  if (includeCost) collect(item?.cost);
  // Finally inspect any nested custom fields so new sheet structures remain
  // parser-compatible without requiring another hard-coded field name.
  collect(item);
  return [...new Set(texts)];
}

function parseBracketExpressions(text = "") {
  const out = [];
  const re = /\[([^\]]+)\]/g;
  let m;
  while ((m = re.exec(String(text)))) {
    const raw = m[1].trim();
    if (raw) out.push(raw);
  }
  return out;
}

function resourceEntries() {
  return Array.isArray(characterDataForRoll()?.resources) ? characterDataForRoll().resources : [];
}

function findResource(code) {
  const n = normalizeParserCode(code);
  return resourceEntries().find(r => normalizeParserCode(r?.code) === n) || null;
}

function findAttribute(code) {
  const n = normalizeParserCode(code);
  const configured = configuredAttributes().find(a => a.code === n);
  if (configured) return configured;
  const character = characterDataForRoll() || {};
  const attrs = Array.isArray(character.attributes) ? character.attributes : [];
  const found = attrs.find(a => normalizeParserCode(a?.code || a?.name || a?.label) === n);
  return found ? { id: found.id || `attribute_${n}`, name: found.name || found.label || n, code: n } : null;
}

function resourceValueMapForCharacter(character) {
  const map = {};
  const attrs = Array.isArray(character?.attributes) ? character.attributes : [];
  const resources = Array.isArray(character?.resources) ? character.resources : [];
  attrs.forEach(item => {
    const code = normalizeParserCode(item?.code || item?.name || item?.label);
    const value = Number(String(item?.value ?? item?.current ?? item?.amount ?? 0).replace(",", "."));
    if (code && Number.isFinite(value)) map[code] = value;
  });
  resources.forEach(item => {
    const code = normalizeParserCode(item?.code || item?.name || item?.label);
    const value = Number(String(item?.value ?? item?.current ?? item?.amount ?? 0).replace(",", "."));
    if (code && Number.isFinite(value)) map[code] = value;
  });
  return map;
}

function configuredResourceMaximum(code, character = characterDataForRoll()) {
  const normalized = normalizeParserCode(code);
  const configured = (Array.isArray(state.table?.configuration?.resources) ? state.table.configuration.resources : [])
    .find(resource => normalizeParserCode(resource?.code || resource?.name || resource?.label) === normalized);
  const characterResource = (Array.isArray(character?.resources) ? character.resources : [])
    .find(resource => normalizeParserCode(resource?.code || resource?.name || resource?.label) === normalized);
  const raw = characterResource?.max ?? characterResource?.maximum ?? characterResource?.maxValue ?? characterResource?.limit
    ?? configured?.maxValue ?? configured?.maximum ?? configured?.max ?? configured?.limit;
  const direct = Number(String(raw ?? "").replace(",", "."));
  if (Number.isFinite(direct)) return direct;
  if (typeof raw !== "string" || !/^\s*\[.*\]\s*$/.test(raw)) return null;
  const expression = raw.trim().slice(1, -1).trim().replace(/\s+/g, "");
  const tokens = expression.match(/[A-Za-zÀ-ÿ][A-Za-zÀ-ÿ0-9_]*|!!|!|\d+(?:[.,]\d+)?|[+\-*/()]/g);
  if (!tokens || tokens.join("") !== expression) return null;
  const attrs = resourceValueMapForCharacter(character);
  let js = "";
  for (const token of tokens) {
    if (/^[A-Za-zÀ-ÿ]/.test(token)) {
      const attrCode = normalizeParserCode(token);
      if (!Object.prototype.hasOwnProperty.call(attrs, attrCode)) return null;
      js += String(attrs[attrCode]);
    } else if (token === "!") {
      const lastCode = tokens.slice(0, tokens.indexOf(token)).reverse().find(x => /^[A-Za-zÀ-ÿ]/.test(x));
      if (!lastCode) return null;
      js += String(attrs[normalizeParserCode(lastCode)] ?? 0);
    } else if (token === "!!") {
      return null;
    } else js += token.replace(",", ".");
  }
  try {
    const value = Number(Function('"use strict";return (' + js + ')')());
    return Number.isFinite(value) ? value : null;
  } catch { return null; }
}

function evaluateParserOperand(code, operator, operand, divisor = 1) {
  const attr = findAttribute(code);
  const resource = findResource(code);
  const base = Number(attr ? (rollValueMap()[normalizeParserCode(code)] ?? 0) : resource ? (resource.value ?? resource.current ?? resource.amount ?? 0) : NaN);

  // ! injeta o valor atual; !! injeta o valor máximo e só é válido para recursos.
  const max = configuredResourceMaximum(code);
  if ((operand === "!" || operand === "!!") && !(operand === "!!" ? resource && Number.isFinite(max) : Number.isFinite(base))) return null;
  const n = operand === "!!" ? max : operand === "!" ? base : Number(String(operand).replace(",", "."));
  if (!Number.isFinite(n)) return null;
  const signed = operator === "-" ? -n : n;
  return signed / divisor;
}

function parseNumericParserExpression(expression) {
  const raw = String(expression ?? "").trim().replace(/\s+/g, "");
  const head = raw.match(/^([A-Za-zÀ-ÿ][A-Za-zÀ-ÿ0-9_]*)(.*)$/);
  if (!head) return null;
  const code = normalizeParserCode(head[1]);
  const attr = findAttribute(code);
  const resource = findResource(code);
  // Um parser explícito entre colchetes é válido mesmo quando o item não possui
  // metadado de "atributo somável". Isso é especialmente importante para
  // equipamentos cuja descrição contém, por exemplo, "causando [DES+3]".
  // Para operações com ! precisamos, naturalmente, encontrar o valor da ficha;
  // para constantes (+3/-3), basta o código ser um código configurado ou ter
  // exatamente o formato de um código de atributo/recurso conhecido pela ficha.
  const knownCode = !!attr || !!resource || configuredAttributes().some(a => a.code === code) || resourceEntries().some(r => normalizeParserCode(r?.code || r?.name || r?.label) === code);
  if (!knownCode) return null;
  let rest = head[2] || "";
  const base = Number(attr ? (rollValueMap()[normalizeParserCode(code)] ?? 0) : resource ? (resource.value ?? resource.current ?? resource.amount ?? 0) : NaN);

  // Sem operador: o parser existe, mas não produz bônus/recurso.
  if (!rest) return { code, delta: 0, attribute: !!findAttribute(code), resource: !!findResource(code) };

  // O primeiro termo precisa ser +N, -N, +! ou -!.
  const first = rest.match(/^([+-])(!!|!|\d+(?:[.,]\d+)?)(.*)$/);
  if (!first) return null;

  const firstValue = evaluateParserOperand(code, first[1], first[2]);
  if (firstValue === null) return null;
  let value = firstValue;
  rest = first[3] || "";

  // Depois do primeiro termo aceitamos operações encadeadas.
  // Ex.: +!+3, -!+3, +!/2, -!*2, +3/2, etc.
  while (rest) {
    const op = rest.match(/^([+\-*/])(!!|!|\d+(?:[.,]\d+)?)(.*)$/);
    if (!op) return null;
    const max = configuredResourceMaximum(code);
    const operand = (op[2] === "!" || op[2] === "!!") ? (op[2] === "!!" ? max : base) : Number(String(op[2]).replace(",", "."));
    if (op[2] === "!" && !Number.isFinite(base)) return null;
    if (op[2] === "!!" && (!resource || !Number.isFinite(max))) return null;
    if (op[2] !== "!" && !Number.isFinite(operand)) return null;

    if (op[1] === "+") value += operand;
    else if (op[1] === "-") value -= operand;
    else if (op[1] === "*") {
      if (op[2] === "!" || op[2] === "!!") return null;
      value *= operand;
    } else if (op[1] === "/") {
      if (op[2] === "!" || op[2] === "!!") return null;
      if (operand === 0) return null;
      value /= operand;
    }
    rest = op[3] || "";
  }

  if (!Number.isFinite(value)) return null;
  return { code, delta: value, attribute: !!findAttribute(code), resource: !!findResource(code) };
}

function parseDeclarationAttributeEffects(item) {
  const effects = {};
  const add = (expr, sign = 1) => {
    const parsed = parseNumericParserExpression(expr);
    if (!parsed || !parsed.attribute) return;
    effects[parsed.code] = (effects[parsed.code] || 0) + parsed.delta * sign;
  };
  declarationParserExpressions(item).forEach(text => parseBracketExpressions(text).forEach(expr => add(expr)));
  return effects;
}

function declarationAttributeParserDetails(item) {
  const details = [];
  const seen = new Set();
  declarationParserExpressions(item).forEach(text => parseBracketExpressions(text).forEach(expr => {
    const raw = String(expr).trim();
    const parsed = parseNumericParserExpression(raw);
    if (!parsed?.attribute) return;
    const key = `${normalizeParserCode(parsed.code)}|${raw}`;
    if (seen.has(key)) return;
    seen.add(key);
    details.push({ code: parsed.code, expression: raw, delta: parsed.delta });
  }));
  return details;
}

function parseDeclarationResourceEffects(item) {
  const effects = {};
  const add = expr => {
    const parsed = parseNumericParserExpression(expr);
    if (!parsed || !parsed.resource) return;
    effects[parsed.code] = (effects[parsed.code] || 0) + parsed.delta;
  };
  declarationParserExpressions(item).forEach(text => parseBracketExpressions(text).forEach(expr => add(expr)));
  return effects;
}

function parseDeclarationCosts(item) {
  const costs = {};
  const costTexts = [];
  if (typeof item?.cost === "string") costTexts.push(item.cost);
  if (Array.isArray(item?.costs)) costTexts.push(...item.costs.filter(x => typeof x === "string"));
  costTexts.forEach(text => parseBracketExpressions(text).forEach(expr => {
    const parsed = parseNumericParserExpression(expr);
    if (!parsed || !parsed.resource) return;
    // Custo é sempre gasto. [MP+2] = -2 MP.
    const amount = Math.abs(parsed.delta || 0);
    costs[parsed.code] = (costs[parsed.code] || 0) - amount;
  }));
  return costs;
}

function currentResourceValue(code) {
  const character = characterDataForRoll() || {};
  const wanted = normalizeParserCode(code);
  const list = Array.isArray(character.resources) ? character.resources : [];
  const found = list.find(resource => normalizeParserCode(resource?.code || resource?.name || resource?.label) === wanted);
  const value = Number(found?.value ?? found?.current ?? found?.amount ?? 0);
  return Number.isFinite(value) ? value : 0;
}

function declarationCostAvailability(item) {
  if (!item || item.kind !== "ability") return { ok: true, insufficient: [] };
  const costs = parseDeclarationCosts(item);
  const insufficient = Object.entries(costs)
    .map(([code, signedCost]) => ({ code, required: Math.abs(Number(signedCost) || 0), current: currentResourceValue(code) }))
    .filter(entry => entry.required > entry.current + 1e-9);
  return { ok: insufficient.length === 0, insufficient };
}

function parseDeclarationDice(item) {
  const dice = [];
  declarationParserExpressions(item).forEach(text => parseBracketExpressions(text).forEach(expr => {
    const m = String(expr).trim().match(/^(\d+)?\s*d\s*(2|4|6|8|10|12|20|100)$/i);
    if (!m) return;
    dice.push({ sides: Number(m[2]), qty: Math.max(1, Number(m[1] || 1)) });
  }));
  return dice;
}

function itemParserCodes(item) {
  // Para equipamentos/habilidades/perícias, os parsers escritos explicitamente
  // entre colchetes são a fonte de verdade. Isso evita carregar códigos antigos
  // ou metadados genéricos de atributo que não fazem parte do efeito real do item.
  if (item?.kind !== "attribute") {
    const explicit = {};
    declarationParserExpressions(item).forEach(text => parseBracketExpressions(text).forEach(expr => {
      const parsed = parseNumericParserExpression(expr);
      if (parsed) explicit[parsed.code] = true;
    }));
    const explicitCodes = Object.keys(explicit);
    if (explicitCodes.length) return explicitCodes;
  }
  const own = item?.attributeCodes?.length ? item.attributeCodes : declarationAttributeCodes(item);
  return own.map(normalizeParserCode).filter(Boolean);
}

function isFreeMode() {
  const t = state.table || {};
  const settings = t.settings || {};
  const c = t.configuration || {};
  const mode = String(settings.mode ?? c.mode ?? c.gameMode ?? c.playMode ?? t.mode ?? t.gameMode ?? t.playMode ?? "free").toLowerCase().trim();
  return ["free", "livre", "free-mode", "modo-livre", "livre / sem restricoes", "livre / sem restrições"].includes(mode) || c.freeMode === true || t.freeMode === true;
}

function isTurnMode() {
  return !isFreeMode();
}

function turnEligibleMembers() {
  const muted = new Set(Array.isArray(state.table?.mutedMembers) ? state.table.mutedMembers : []);
  return state.members.filter(member => member?.uid && !muted.has(member.uid));
}

function currentTurnUid() {
  if (!isTurnMode()) return null;
  const eligible = turnEligibleMembers();
  if (!eligible.length) return null;
  const stored = state.table?.currentTurnUid;
  if (stored && eligible.some(member => member.uid === stored)) return stored;
  const last = state.table?.lastTurnBy;
  if (last) {
    const index = eligible.findIndex(member => member.uid === last);
    if (index >= 0) return eligible[(index + 1) % eligible.length].uid;
  }
  return eligible[0].uid;
}

function isUsersTurn() {
  return state.isMaster || !isTurnMode() || currentTurnUid() === state.user?.uid;
}

function renderTurnQueue(root) {
  const queue = root?.querySelector("#rp-turn-queue");
  if (!queue) return;
  if (!isTurnMode()) {
    queue.hidden = true;
    queue.style.display = "none";
    queue.innerHTML = "";
    return;
  }
  queue.hidden = false;
  queue.style.display = "";
  const eligible = turnEligibleMembers();
  if (!eligible.length) {
    queue.hidden = false;
    queue.style.display = "";
    queue.innerHTML = `<span class="rp-turn-empty">Nenhum membro com turno.</span>`;
    return;
  }
  const current = currentTurnUid();
  const start = Math.max(0, eligible.findIndex(member => member.uid === current));
  const visible = Array.from({ length: Math.min(5, Math.max(eligible.length, 1)) }, (_, i) => eligible[(start + i) % eligible.length]);
  queue.hidden = false;
  queue.innerHTML = visible.map((member, index) => {
    const photo = member.avatarDataUrl || member.photoURL || "";
    const active = index === 0;
    const avatar = photo ? `<img src="${esc(photo)}" alt="">` : esc(initials(member.username || "Usuário"));
    const title = esc(member.username || "Usuário");
    return `${index ? `<span class="rp-turn-arrow" aria-hidden="true">›</span>` : ""}<div class="rp-turn-member ${active ? "active" : ""}" title="${title}"><span class="rp-turn-avatar">${avatar}</span></div>`;
  }).join("");
}

function updateTurnControls(root) {
  if (!root) return;
  const turnMode = isTurnMode();
  const allowed = isUsersTurn();
  const input = root.querySelector("#rp-input");
  const send = root.querySelector("#rp-send");
  const attach = root.querySelector("#rp-attach");
  const quickDial = root.querySelector("#rp-quick-dial");
  let quickTurn = root.querySelector('[data-action="turn"]');
  if (quickDial) {
    const shouldHaveTurn = turnMode;
    if (shouldHaveTurn && !quickTurn) {
      const button = document.createElement("button");
      button.className = "rp-quick-item";
      button.dataset.action = "turn";
      button.type = "button";
      button.innerHTML = `<span class="rp-quick-icon">${svgIcon("turn")}</span><span>${state.isMaster ? "Pular turno" : "Finalizar turno"}</span>`;
      button.addEventListener("click", () => finishTurn(root));
      quickDial.appendChild(button);
      quickTurn = button;
    } else if (!shouldHaveTurn && quickTurn) {
      quickTurn.remove();
      quickTurn = null;
    }
  }
  const canAct = !state.mutedByTable && allowed;
  if (input) {
    input.disabled = !canAct;
    input.placeholder = state.mutedByTable ? "Você está silenciado" : turnMode && !allowed ? "Aguarde seu turno" : "Mensagem";
  }
  if (send) send.disabled = !canAct;
  if (attach) attach.disabled = !canAct;
  if (quickTurn) {
    quickTurn.disabled = !canAct;
    quickTurn.querySelector("span:last-child").textContent = state.isMaster ? "Pular turno" : "Finalizar turno";
  }
  renderTurnQueue(root);
}

function messageMillis(message) {
  // createdAtMs é o relógio de ordenação do fluxo visual. O serverTimestamp()
  // continua sendo mantido para auditoria, mas respostas do NPC podem receber
  // timestamps de servidor muito próximos e acabar agrupadas após as mensagens.
  const clientMs = Number(message?.createdAtMs);
  if (Number.isFinite(clientMs) && clientMs > 0) return clientMs;
  const ts = message?.createdAt;
  if (!ts) return 0;
  if (typeof ts.toMillis === "function") return ts.toMillis();
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return Number.isFinite(d.getTime()) ? d.getTime() : 0;
}

function getActiveParserCodes() {
  if (isFreeMode() || state.isMaster) return [];
  const ordered = [...state.messages].sort((a, b) => messageMillis(a) - messageMillis(b));
  const lastTurn = ordered.reduce((latest, message) => {
    if (message?.systemEvent === "turn-finished" && message?.actorUid === state.user?.uid) return Math.max(latest, messageMillis(message));
    return latest;
  }, 0);
  const latestRestriction = [...ordered].reverse().find(message =>
    roleForMessage(message) === "master" && Array.isArray(message.parserCodes) && message.parserCodes.length && messageMillis(message) > lastTurn
  );
  const codes = latestRestriction?.parserCodes || [];
  state.activeParserCodes = codes.map(normalizeParserCode).filter(Boolean);
  return state.activeParserCodes;
}

function declarationMatchesParsers(item) {
  const active = getActiveParserCodes();
  if (!active.length || item.kind === "dice") return true;
  const own = itemParserCodes(item);
  // Restrição por /ATR: itens sem atributos são sempre liberados.
  // Itens com atributos só são liberados se possuírem pelo menos um dos
  // atributos restritos. Na hora do bônus, apenas os atributos restritos
  // são contabilizados (FOR+DES com /FOR usa somente FOR).
  if (!own.length) return true;
  return own.some(code => active.includes(code));
}

function declarationIsRestricted(item) {
  return !declarationMatchesParsers(item);
}

// ============================================================
// COMPRESSÃO DE FOTO PARA MENSAGEM
// ============================================================

async function imageFileToDataURL(file, maxSide = 900, targetKB = 220) {
  if (!file || !file.type.startsWith("image/")) {
    throw new Error("Selecione uma imagem válida.");
  }

  const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" }).catch(() => null);
  const img = bitmap || await new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const el = new Image();
    el.onload = () => { URL.revokeObjectURL(url); resolve(el); };
    el.onerror = () => { URL.revokeObjectURL(url); reject(new Error("Não foi possível abrir a imagem.")); };
    el.src = url;
  });

  const sourceW = img.width;
  const sourceH = img.height;
  const scale = Math.min(1, maxSide / Math.max(sourceW, sourceH));
  const w = Math.max(1, Math.round(sourceW * scale));
  const h = Math.max(1, Math.round(sourceH * scale));

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d", { alpha: false });
  ctx.fillStyle = "#111";
  ctx.fillRect(0, 0, w, h);
  ctx.drawImage(img, 0, 0, w, h);

  if (bitmap) bitmap.close?.();

  let quality = .84;
  let data = canvas.toDataURL("image/jpeg", quality);
  while (data.length * .75 / 1024 > targetKB && quality > .35) {
    quality -= .07;
    data = canvas.toDataURL("image/jpeg", quality);
  }

  if (data.length * .75 / 1024 > targetKB * 1.35) {
    canvas.width = Math.max(480, Math.round(w * .78));
    canvas.height = Math.max(480, Math.round(h * .78));
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    quality = .68;
    data = canvas.toDataURL("image/jpeg", quality);
  }

  return data;
}

// ============================================================
// RENDER
// ============================================================

export async function render(params = {}) {
  const root = document.createElement("div");
  root.className = "roleplay-view";
  root.innerHTML = `<div class="rp-loading"><div class="rp-spinner"></div><span>Entrando na mesa...</span></div>`;

  state.tableId = params.tableId || params.id || null;
  state.user = auth.currentUser;

  if (!state.user || !state.tableId) {
    navigate("/home");
    return root;
  }

  injectStyles();

  try {
    await loadTable();
    if (!state.table) throw new Error("Mesa não encontrada.");
    if (!Array.isArray(state.table.members) || !state.table.members.includes(state.user.uid)) {
      throw new Error("Você não faz parte desta mesa.");
    }

    state.isMaster = isMaster();
    await clearUnread();
    await loadMembers();
    await loadRollCharacter();

    root.innerHTML = buildShell();
    bindShell(root);
    subscribeMessages(root);
    subscribeTable(root);

    if (!state.isMaster) {
      await verifyCharacterAccess(root);
    }

    return root;
  } catch (error) {
    console.error("Erro ao abrir roleplay:", error);
    root.innerHTML = `
      <div class="rp-error-screen">
        <button class="rp-error-back" type="button">${svgIcon("back")} Voltar</button>
        <div class="rp-error-card">
          <div class="rp-error-icon">!</div>
          <h2>Não foi possível abrir a mesa</h2>
          <p>${esc(error.message || "Tente novamente.")}</p>
          <button class="rp-primary" type="button" id="rp-retry">Tentar novamente</button>
        </div>
      </div>`;
    root.querySelector(".rp-error-back")?.addEventListener("click", () => navigate("/home"));
    root.querySelector("#rp-retry")?.addEventListener("click", () => navigate(`/roleplay/${encodeURIComponent(state.tableId)}`));
    return root;
  }
}

// ============================================================
// DADOS DA MESA
// ============================================================

async function loadTable() {
  const snap = await getDoc(doc(db, "tables", state.tableId));
  state.table = snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

async function loadMembers() {
  const ids = Array.isArray(state.table?.members) ? state.table.members : [];
  const members = [];
  for (const uid of ids) {
    try {
      const snap = await getDoc(doc(db, "users", uid));
      if (!snap.exists()) continue;
      let avatarDataUrl = "";
      try {
        const avatarSnap = await getDoc(doc(db, "users", uid, "profile", "avatar"));
        avatarDataUrl = avatarSnap.exists() ? (avatarSnap.data()?.dataUrl || "") : "";
      } catch (avatarError) {
        console.warn("Falha ao carregar avatar do membro", uid, avatarError);
      }
      const userData = snap.data() || {};
      members.push({ uid, ...userData, avatarDataUrl, characterName: userData.characterName || userData.character?.name || userData.currentCharacterName || "Sem personagem" });
    } catch (error) {
      console.warn("Falha ao carregar membro", uid, error);
    }
  }
  state.members = members;
}

function syncMemberSubscriptions(root) {
  state.unsubscribeMembers?.();

  const ids = Array.isArray(state.table?.members) ? state.table.members : [];
  const records = new Map();
  const unsubs = [];

  const publish = uid => {
    const record = records.get(uid);
    if (!record || !record.exists) {
      state.members = state.members.filter(member => member.uid !== uid);
      renderMessages(root);
      return;
    }

    const next = {
      uid,
      ...record.userData,
      avatarDataUrl: record.avatarDataUrl || ""
    };
    const index = state.members.findIndex(member => member.uid === uid);
    if (index >= 0) state.members[index] = next;
    else state.members.push(next);

    state.members = state.members.filter(member => ids.includes(member.uid));
    renderMessages(root);

    // Se os detalhes da mesa estiverem abertos, atualiza a lista sem exigir
    // que o usuário feche e abra novamente.
    const list = document.querySelector(".rp-table-details-backdrop .rp-members-list");
    if (list) {
      const rows = state.members.map(member => {
        const master = member.uid === state.table.ownerId;
        const mine = member.uid === state.user.uid;
        const muted = Array.isArray(state.table.mutedMembers) && state.table.mutedMembers.includes(member.uid);
        const photo = member.avatarDataUrl || "";
        return `<button class="rp-member-row" data-member="${esc(member.uid)}" type="button"><span class="rp-member-avatar">${photo ? `<img src="${esc(photo)}" alt="">` : esc(initials(member.username))}</span><span class="rp-member-main"><strong>${esc(member.username || "Usuário")}</strong><small>${esc(member.characterName || member.character || "Sem personagem")}${muted ? " · silenciado" : ""}</small></span>${master ? `<span class="rp-crown">${svgIcon("crown")}</span>` : ""}${!mine ? `<span class="rp-member-chevron">›</span>` : ""}</button>`;
      }).join("");
      list.innerHTML = rows || `<div class="rp-empty">Nenhum membro.</div>`;
      list.querySelectorAll(".rp-member-row").forEach(row => row.addEventListener("click", () => {
        if (row.dataset.member !== state.user.uid && state.isMaster) openMemberActions(row.dataset.member);
      }));
    }
  };

  for (const uid of ids) {
    const record = { exists: false, userData: {}, avatarDataUrl: "" };
    records.set(uid, record);

    unsubs.push(onSnapshot(doc(db, "users", uid), snap => {
      record.exists = snap.exists();
      record.userData = snap.exists() ? (snap.data() || {}) : {};
      publish(uid);
    }, error => console.warn("Falha ao acompanhar perfil do membro", uid, error)));

    unsubs.push(onSnapshot(doc(db, "users", uid, "profile", "avatar"), snap => {
      record.avatarDataUrl = snap.exists() ? (snap.data()?.dataUrl || "") : "";
      publish(uid);
    }, error => console.warn("Falha ao acompanhar avatar do membro", uid, error)));
  }

  state.unsubscribeMembers = () => {
    unsubs.splice(0).forEach(unsubscribe => unsubscribe?.());
    records.clear();
  };
}


function activeRollCharacterRef() {
  const activeNpcId = state.isMaster ? String(state.table?.activeMasterNpcId || "").trim() : "";
  return activeNpcId ? doc(db, "tables", state.tableId, "npcs", activeNpcId) : null;
}

async function loadRollCharacter() {
  state.rollCharacter = {};

  // Quando o mestre seleciona "Usar essa ficha" em um NPC, a ficha ativa
  // passa a ser a fonte de verdade das rolagens: atributos, perícias,
  // habilidades, equipamentos e recursos pertencem ao NPC.
  const activeNpcRef = activeRollCharacterRef();
  if (activeNpcRef) {
    try {
      const snap = await getDoc(activeNpcRef);
      if (snap.exists()) {
        state.rollCharacter = snap.data() || {};
        return;
      }
    } catch (error) {
      console.warn("Não foi possível carregar a ficha do NPC ativo.", error);
    }
  }

  // Sem NPC ativo, mantém exatamente o comportamento anterior para
  // personagens de jogadores.
  const refs = [
    doc(db, "tables", state.tableId, "characters", state.user.uid),
    doc(db, "users", state.user.uid, "characterSheets", state.tableId)
  ];
  for (const ref of refs) {
    try {
      const snap = await getDoc(ref);
      if (snap.exists()) { state.rollCharacter = snap.data() || {}; return; }
    } catch (error) {
      console.warn("Não foi possível carregar a ficha para declarações.", error);
    }
  }
}

function renderCharacterAccessLock(root, locked = true, status = "draft") {
  root.querySelector(".rp-lock-overlay")?.remove();
  if (!locked) return;

  const lock = document.createElement("div");
  lock.className = "rp-lock-overlay";
  const message = status === "pending"
    ? "Sua ficha foi enviada e está aguardando a aprovação do mestre."
    : status === "rejected"
      ? "Sua ficha foi devolvida para edição. Envie novamente depois de corrigir os dados."
      : "Para participar do roleplay, primeiro você precisa criar e enviar sua ficha de personagem.";

  lock.innerHTML = `
    <div class="rp-lock-card">
      <div class="rp-lock-mark">✦</div>
      <h2>${status === "pending" ? "Aguardando aprovação" : "Sua ficha ainda não está pronta"}</h2>
      <p>${esc(message)}</p>
      <button class="rp-primary" id="rp-open-sheet" type="button">Abrir minha ficha</button>
      <button class="rp-ghost" id="rp-lock-home" type="button">Voltar para a Home</button>
    </div>`;
  root.appendChild(lock);
  root.querySelector("#rp-open-sheet")?.addEventListener("click", () => navigate(`/character-sheet/${encodeURIComponent(state.tableId)}`));
  root.querySelector("#rp-lock-home")?.addEventListener("click", () => navigate("/home"));
}

async function verifyCharacterAccess(root) {
  // character-sheet.js usa IDs próprios (character_xxx). Portanto, NUNCA
  // podemos assumir que characters/{uid} é o documento do player.
  // A fonte de verdade é ownerUid/uid dentro de tables/{tableId}/characters.
  state.unsubscribeCharacterAccess?.();

  const evaluate = snapshot => {
    let playerCharacter = null;

    snapshot.forEach(snap => {
      const raw = snap.data() || {};
      const ownerUid = raw.ownerUid || raw.uid;
      if (ownerUid !== state.user.uid) return;
      if (raw.type === "npc" || raw.npcId) return;

      // Se houver mais de uma ficha, priorizamos uma viva; depois, a mais
      // avançada no fluxo de aprovação.
      const candidate = { id: snap.id, ...raw };
      if (!playerCharacter) {
        playerCharacter = candidate;
        return;
      }
      const rank = c => ({ approved: 4, pending: 3, rejected: 2, draft: 1, dead: 0 }[c?.status] ?? 0);
      const currentScore = rank(playerCharacter) + (playerCharacter.alive === false ? -10 : 0);
      const nextScore = rank(candidate) + (candidate.alive === false ? -10 : 0);
      if (nextScore > currentScore) playerCharacter = candidate;
    });

    const approved = !!playerCharacter && playerCharacter.status === "approved" && playerCharacter.alive !== false;
    renderCharacterAccessLock(root, !approved, playerCharacter?.status || "draft");
  };

  // Uma única assinatura em tempo real resolve tanto a aprovação posterior
  // quanto uma devolução/reenvio da ficha, sem exigir sair e entrar na mesa.
  state.unsubscribeCharacterAccess = onSnapshot(
    collection(db, "tables", state.tableId, "characters"),
    evaluate,
    error => {
      console.error("Erro ao acompanhar aprovação da ficha:", error);
      renderCharacterAccessLock(root, true, "draft");
    }
  );

  // Também força uma leitura inicial antes de a assinatura receber o primeiro
  // snapshot, caso o navegador esteja retomando uma tela já montada.
  try {
    const snapshot = await getDocs(collection(db, "tables", state.tableId, "characters"));
    evaluate(snapshot);
  } catch (error) {
    console.warn("Não foi possível verificar a ficha do player:", error);
  }
}

// ============================================================
// SHELL
// ============================================================

function buildShell() {
  const master = state.isMaster;
  return `
    <div class="rp-screen">
      <header class="rp-header">
        <button class="rp-back" id="rp-back" type="button" aria-label="Voltar para Home">${svgIcon("back")}</button>
        <button class="rp-title-button" id="rp-table-details" type="button">
          <strong>${esc(state.table.name || "Mesa sem nome")}</strong>
          <span>${master ? "Mestre" : "Player"}</span>
        </button>
        <button class="rp-header-more" id="rp-header-more" type="button" aria-label="Detalhes">${svgIcon("more")}</button>
      </header>

      <main class="rp-chat" id="rp-chat">
        <div class="rp-turn-queue" id="rp-turn-queue" hidden aria-label="Fila de turnos"></div>
        <div class="rp-chat-inner" id="rp-messages"></div>
      </main>

      <div class="rp-composer-wrap">
        <div class="rp-quick-dial" id="rp-quick-dial" aria-hidden="true">
          <button class="rp-quick-item" data-action="dice" type="button">
            <span class="rp-quick-icon rp-dice-button-icon">${renderSVG_D20()}</span>
            <span>Dados</span>
          </button>
          <button class="rp-quick-item" data-action="sheet" type="button">
            <span class="rp-quick-icon">${svgIcon("sheet")}</span>
            <span>Ficha</span>
          </button>
          ${isTurnMode() ? `<button class="rp-quick-item" data-action="turn" type="button">
            <span class="rp-quick-icon">${svgIcon("turn")}</span>
            <span>${master ? "Pular turno" : "Finalizar turno"}</span>
          </button>` : ""}
        </div>

        <div class="rp-parser-menu" id="rp-parser-menu" hidden></div>
        <div class="rp-composer" id="rp-composer">
          <button class="rp-attach" id="rp-attach" type="button" aria-label="Adicionar foto">${svgIcon("clip")}</button>
          <textarea id="rp-input" rows="1" maxlength="4000" placeholder="Mensagem" autocomplete="off"></textarea>
          <button class="rp-send" id="rp-send" type="button" aria-label="Enviar">${svgIcon("send")}</button>
          <input id="rp-photo-input" type="file" accept="image/*" hidden>
        </div>
      </div>
    </div>
  `;
}

function bindShell(root) {
  root.querySelector("#rp-back")?.addEventListener("click", async () => { await clearUnread(); navigate("/home"); });
  root.querySelector("#rp-header-more")?.addEventListener("click", () => openTableDetails(root));

  const input = root.querySelector("#rp-input");
  const send = root.querySelector("#rp-send");
  const attach = root.querySelector("#rp-attach");
  const photo = root.querySelector("#rp-photo-input");

  send?.addEventListener("click", () => sendText(root));
  input?.addEventListener("keydown", event => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      sendText(root);
    }
  });
  input?.addEventListener("input", event => { autoGrow(event); updateComposerAssist(root); if (input.value.trim()) scheduleTyping(root); else { clearTimeout(state.typingTimer); setTyping(false); } });
  input?.addEventListener("blur", () => { clearTimeout(state.typingTimer); setTyping(false); });
  input?.addEventListener("click", () => updateComposerAssist(root));
  input?.addEventListener("keyup", () => updateComposerAssist(root));
  input?.addEventListener("blur", () => setTimeout(() => hideComposerAssist(root), 120));

  attach?.addEventListener("click", () => photo.click());
  photo?.addEventListener("change", () => handlePhoto(root, photo.files?.[0]));

  bindQuickDial(root);
  bindComposerGesture(root);
  updateTurnControls(root);
}

function autoGrow(event) {
  const el = event.currentTarget;
  el.style.height = "auto";
  el.style.height = `${Math.min(el.scrollHeight, 130)}px`;
}

// ============================================================
// AÇÕES DE MENSAGEM
// ============================================================

function bindMessageLongPress(container) {
  container.querySelectorAll(".rp-message-hit").forEach(el => {
    let timer = null;
    const start = event => {
      const id = el.dataset.messageId;
      timer = setTimeout(() => { timer = null; openMessageActions(id); }, 550);
    };
    const cancel = () => { if (timer) { clearTimeout(timer); timer = null; } };
    el.addEventListener("pointerdown", start);
    el.addEventListener("pointerup", cancel);
    el.addEventListener("pointercancel", cancel);
    el.addEventListener("pointerleave", cancel);
    el.addEventListener("contextmenu", event => { event.preventDefault(); openMessageActions(el.dataset.messageId); });
  });
}

async function deleteMessage(message) {
  if (!message) return;
  const mine = message.uid === state.user?.uid;
  if (!mine && !state.isMaster) return toast("Você só pode apagar suas próprias mensagens.", "error");
  try {
    await deleteDoc(doc(db, "tables", state.tableId, "messages", message.id));
    toast("Mensagem apagada.", "success");
  } catch (error) { console.error(error); toast("Não foi possível apagar a mensagem.", "error"); }
}

function openMessageActions(messageId) {
  const message = state.messages.find(m => m.id === messageId);
  if (!message || message.type === "bot") return;
  const mine = message.uid === state.user?.uid;
  const canDelete = mine || state.isMaster;
  const canEdit = mine && message.type === "text" && !message.roll;
  const body = `<div class="rp-message-actions">
    ${canEdit ? `<button type="button" id="rp-edit-message">✏️ <span>Editar mensagem</span></button>` : ""}
    ${canDelete ? `<button type="button" id="rp-delete-message" class="danger">🗑️ <span>Apagar mensagem</span></button>` : ""}
    ${!canEdit && !canDelete ? `<div class="rp-empty">Nenhuma ação disponível.</div>` : ""}
  </div>`;
  const modal = openModal("Mensagem", body);
  modal.querySelector("#rp-edit-message")?.addEventListener("click", () => {
    const editor = openModal("Editar mensagem", `<textarea id="rp-edit-text" class="rp-edit-message-input" maxlength="4000">${esc(message.text || "")}</textarea><button class="rp-primary" id="rp-save-message" type="button">Salvar</button>`, () => openMessageActions(messageId));
    editor.querySelector("#rp-save-message")?.addEventListener("click", async () => {
      const text = editor.querySelector("#rp-edit-text")?.value.trim();
      if (!text) return toast("A mensagem não pode ficar vazia.", "error");
      try { await updateDoc(doc(db, "tables", state.tableId, "messages", message.id), { text, edited: true, editedAt: serverTimestamp() }); closeModal(); toast("Mensagem editada.", "success"); }
      catch (error) { console.error(error); toast("Não foi possível editar a mensagem.", "error"); }
    });
  });
  modal.querySelector("#rp-delete-message")?.addEventListener("click", async () => {
    closeModal();
    const confirm = openModal("Apagar mensagem", `<div class="rp-confirm-modal"><p>Apagar esta mensagem da mesa?</p><button class="rp-primary" id="rp-confirm-delete" type="button">Apagar</button></div>`);
    confirm.querySelector("#rp-confirm-delete")?.addEventListener("click", async () => { closeModal(); await deleteMessage(message); });
  });
}

// ============================================================
// NOTIFICAÇÕES DA MESA
// ============================================================

async function bumpUnread(excludeUid = null) {
  const ids = Array.isArray(state.table?.members) ? state.table.members : [];
  const updates = {};

  // Cada membro possui seu próprio contador.
  // increment(1) é atômico, então 5 mensagens recebidas
  // resultam em 5, mesmo que cheguem quase simultaneamente.
  ids.forEach(uid => {
    if (!uid || uid === excludeUid) return;
    updates[`unreadCounts.${uid}`] = increment(1);
  });

  if (!Object.keys(updates).length) return;

  try {
    await updateDoc(doc(db, "tables", state.tableId), updates);

    // Mantém o estado local coerente imediatamente, sem depender
    // do próximo snapshot para o contador visual.
    state.table.unreadCounts = {
      ...(state.table.unreadCounts || {})
    };

    ids.forEach(uid => {
      if (!uid || uid === excludeUid) return;
      state.table.unreadCounts[uid] =
        Number(state.table.unreadCounts[uid] || 0) + 1;
    });
  } catch (error) {
    console.warn("Não foi possível atualizar notificações da mesa:", error);
  }
}

async function clearUnread() {
  if (!state.user?.uid) return;

  try {
    await updateDoc(doc(db, "tables", state.tableId), {
      [`unreadCounts.${state.user.uid}`]: 0
    });

    state.table.unreadCounts = {
      ...(state.table.unreadCounts || {}),
      [state.user.uid]: 0
    };
  } catch (error) {
    console.warn("Não foi possível limpar notificações da mesa:", error);
  }
}

// ============================================================
// CHAT EM TEMPO REAL
// ============================================================

function subscribeMessages(root) {
  state.unsubscribeMessages?.();
  const messagesRef = collection(db, "tables", state.tableId, "messages");
  const q = query(messagesRef, orderBy("createdAt", "asc"), limit(300));
  state.unsubscribeMessages = onSnapshot(q, snapshot => {
    state.messages = snapshot.docs.map(d => ({ id: d.id, ...d.data() }))
      .sort((a, b) => messageMillis(a) - messageMillis(b) || String(a.id).localeCompare(String(b.id)));
    renderMessages(root);
  }, error => {
    console.error("Erro ao acompanhar mensagens:", error);
    toast("Não foi possível atualizar o chat.", "error");
  });
}

function subscribeTable(root) {
  state.unsubscribeTable?.();
  state.unsubscribeTable = onSnapshot(doc(db, "tables", state.tableId), snap => {
    if (!snap.exists()) return;
    const previousActiveNpc = String(state.table?.activeMasterNpcId || "");
    state.table = { id: snap.id, ...snap.data() };
    state.typingUsers = state.table.typing || {};
    state.isMaster = isMaster();
    state.mutedByTable = Array.isArray(state.table.mutedMembers) && state.table.mutedMembers.includes(state.user.uid);
    const nextActiveNpc = String(state.table?.activeMasterNpcId || "");
    if (state.isMaster && previousActiveNpc !== nextActiveNpc) {
      loadRollCharacter().catch(error => console.warn("Não foi possível atualizar a ficha ativa das rolagens.", error));
    }
    syncMemberSubscriptions(root);
    updateTurnControls(root);
    renderMessages(root);
  });
}

function renderMessages(root) {
  const container = root.querySelector("#rp-messages");
  if (!container) return;
  if (!state.messages.length) {
    container.innerHTML = `<div class="rp-day"><span>A aventura começa aqui</span></div>`;
    updateTurnControls(root);
    return;
  }

  getActiveParserCodes();

  let previousDay = "";
  container.innerHTML = state.messages.map(message => {
    const role = roleForMessage(message);
    const mine = message.uid === state.user.uid;
    const bot = role === "bot";
    const dayKey = message.createdAt?.toDate ? message.createdAt.toDate().toLocaleDateString("pt-BR") : "";
    const day = dayKey && dayKey !== previousDay ? `<div class="rp-day"><span>${esc(dayKey)}</span></div>` : "";
    previousDay = dayKey || previousDay;

    const sender = message.username || memberName(message.uid);
    const photo = message.photoURL || memberPhoto(message.uid);
    const bubbleClass = `rp-bubble-wrap role-${role} ${mine && !bot ? "mine" : ""} ${bot ? "bot" : ""}`;
    const avatar = bot ? `<div class="rp-avatar rp-bot-avatar">✦</div>` : `<div class="rp-avatar">${photo ? `<img src="${esc(photo)}" alt="">` : esc(initials(sender))}</div>`;

    let body;
    if (message.roll) {
      const canSeeDetails = message.roll.rollerUid === state.user.uid || message.roll.privateTo?.includes(state.user.uid) || state.isMaster;
      body = `<div class="rp-message-text">🎲 ${esc(message.text || "Rolagem")}</div>${canSeeDetails ? `<div class="rp-roll-details"><strong>Detalhes</strong><span class="rp-roll-detail-line">${esc(message.roll.details || "")}</span>${message.roll.declarations?.length ? `<small>Declarações: ${esc(message.roll.declarations.map(d => `${d.qty}× ${d.kind === "dice" ? `D${d.sides}` : d.name}`).join(" • "))}</small>` : ""}</div>` : ""}`;
    } else if (message.type === "image") {
      body = `<button class="rp-photo-message" type="button" data-photo="${esc(message.imageData || "")}"><img src="${esc(message.imageData || "")}" alt="Imagem enviada"></button>${message.text ? `<div class="rp-caption">${esc(message.text)}</div>` : ""}`;
    } else {
      const parserCodes = Array.isArray(message.parserCodes) ? message.parserCodes : [];
      body = `<div class="rp-message-text">${esc(message.text || "").replace(/\n/g, "<br>")}</div>${state.isMaster && parserCodes.length ? `<div class="rp-parser-markers"><span>Parsers:</span>${parserCodes.map(code => `<b>/${esc(code)}</b>`).join("")}</div>` : ""}`;
    }

    const name = bot ? "NPC" : sender;
    return `${day}<div class="${bubbleClass}" data-message-id="${esc(message.id)}"><div class="rp-message-hit" data-message-id="${esc(message.id)}">${!mine && !bot ? avatar : ""}<div class="rp-bubble"><div class="rp-sender">${esc(name)}</div>${body}<div class="rp-meta">${esc(formatTime(message.createdAt))}</div></div>${mine && !bot ? avatar : ""}</div></div>`;
  }).join("");
  const typing = typingLabel();
  if (typing) container.insertAdjacentHTML("beforeend", `<div class="rp-typing-wrap"><div class="rp-avatar rp-typing-avatar">${esc(initials(typing.split(" ")[0]))}</div><div class="rp-typing-bubble"><span class="rp-typing-text">${esc(typing)}</span><i></i><i></i><i></i></div></div>`);

  container.querySelectorAll(".rp-photo-message").forEach(button => {
    button.addEventListener("click", () => openPhotoViewer(button.dataset.photo || ""));
  });
  bindMessageLongPress(container);

  updateTurnControls(root);
  requestAnimationFrame(() => {
    const chat = root.querySelector("#rp-chat");
    if (chat) chat.scrollTop = chat.scrollHeight;
  });
}

// ============================================================
// DIGITANDO...
// ============================================================

async function setTyping(active) {
  if (!state.user?.uid || !state.tableId) return;
  const key = `typing.${state.user.uid}`;
  try {
    if (active) {
      await updateDoc(doc(db, "tables", state.tableId), {
        [key]: { name: state.user.displayName || "Usuário", at: Date.now() }
      });
    } else {
      await updateDoc(doc(db, "tables", state.tableId), { [key]: null });
    }
  } catch (error) { console.debug("typing", error); }
}

function scheduleTyping(root) {
  clearTimeout(state.typingTimer);
  setTyping(true);
  state.typingTimer = setTimeout(() => setTyping(false), 2200);
}

function typingLabel() {
  const names = Object.entries(state.typingUsers || {})
    .filter(([uid, data]) => uid !== state.user?.uid && data && Date.now() - Number(data.at || 0) < 5000)
    .map(([, data]) => data.name || "Alguém");
  if (!names.length) return "";
  if (names.length === 1) return `${names[0]} está digitando`;
  if (names.length === 2) return `${names[0]} e ${names[1]} estão digitando`;
  return `${names[0]} e mais ${names.length - 1} estão digitando`;
}

// ============================================================
// COMANDOS DE INVENTÁRIO / MORTE DO MESTRE
// ============================================================

function splitCommandArgs(body = "") {
  return String(body).split(";").map(v => v.trim());
}

function equipmentSettings() {
  return state.table?.configuration?.equipmentSettings || state.table?.configuration?.equipment || {};
}

function configuredEquipmentItem(name) {
  const wanted = String(name || "").trim().toLocaleLowerCase("pt-BR");
  const list = Array.isArray(state.table?.configuration?.equipment) ? state.table.configuration.equipment : [];
  return list.find(item => String(item?.name || item?.label || item || "").trim().toLocaleLowerCase("pt-BR") === wanted) || null;
}

function equipmentLoadSystem() {
  const set = equipmentSettings();
  return String(set.loadSystem || set.system || set.capacitySystem || "free").toLowerCase();
}

function equipmentUnit() {
  const set = equipmentSettings();
  const system = equipmentLoadSystem();
  if (system === "weight") return String(set.weightUnit || set.loadUnit || "kg").trim();
  if (system === "unit") return String(set.loadUnit || "un").trim();
  if (system === "custom") return String(set.loadUnit || set.customEquipmentName || "").trim();
  return "";
}

function parseInventoryQuantity(raw) {
  const text = String(raw ?? "").trim();
  const system = equipmentLoadSystem();
  if (!text) return null;

  if (system === "slot") {
    const fractional = /\/$/.test(text);
    const numberText = fractional ? text.slice(0, -1).trim() : text;
    const value = Number(numberText.replace(",", "."));
    if (!Number.isFinite(value) || value < 0) return null;
    return { value, fractional, display: fractional ? `${value}/` : String(value) };
  }

  const unit = equipmentUnit();
  if (!unit) return null;
  const escaped = unit.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = text.match(new RegExp(`^([+-]?(?:\\d+(?:[.,]\\d+)?|\\.\\d+))\\s*${escaped}$`, "i"));
  if (!match) return null;
  const value = Number(match[1].replace(",", "."));
  if (!Number.isFinite(value) || value < 0) return null;
  return { value, fractional: false, unit, display: `${value}${unit}` };
}

function characterEquipmentList(character) {
  if (!Array.isArray(character.equipment)) character.equipment = [];
  return character.equipment;
}

function findCharacterEquipment(character, name) {
  const wanted = String(name || "").trim().toLocaleLowerCase("pt-BR");
  return characterEquipmentList(character).find(item => String(item?.name || "").trim().toLocaleLowerCase("pt-BR") === wanted) || null;
}

async function saveCommandCharacter(target, character) {
  const ref = target?.ref;
  if (!ref) throw new Error("Alvo da ficha inválido.");
  const uid = target.member?.uid || ref.id;
  const safe = firestoreSafe({ ...character, uid, tableId: state.tableId, updatedAt: serverTimestamp() });
  await setDoc(ref, safe, { merge: true });
}

function normalizedTargetName(value) {
  return String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().replace(/\s+/g, " ").toLocaleLowerCase("pt-BR");
}

async function findCharacterTarget(name) {
  const wanted = normalizedTargetName(name);
  if (!wanted) return null;

  // Comandos de mesa usam SEMPRE o nome da ficha, nunca o nome da conta.
  // Primeiro procuramos personagens de players.
  const chars = await getDocs(collection(db, "tables", state.tableId, "characters"));
  for (const snap of chars.docs) {
    const c = snap.data() || {};
    const characterName = normalizedTargetName(c.profile?.name || c.name || "");
    if (characterName === wanted) {
      const member = state.members.find(x => x.uid === (c.ownerUid || c.uid || snap.id)) || {
        uid: c.ownerUid || c.uid || snap.id,
        username: c.profile?.name || c.name || name
      };
      return { member, ref: snap.ref, character: c, type: "character" };
    }
  }

  // NPCs vivem em outra coleção, mas para os parsers & passam a ser tratados
  // exatamente como personagens: o alvo é encontrado pelo nome da ficha.
  const npcs = await getDocs(collection(db, "tables", state.tableId, "npcs"));
  for (const snap of npcs.docs) {
    const c = snap.data() || {};
    const characterName = normalizedTargetName(c.profile?.name || c.name || "");
    if (characterName === wanted) {
      const npcUid = c.npcId || c.characterId || snap.id;
      const member = { uid: npcUid, username: c.profile?.name || c.name || name, isNpc: true };
      return { member, ref: snap.ref, character: c, type: "npc" };
    }
  }

  return null;
}

function findCharacterResource(character, resourceName) {
  const wanted = String(resourceName || "").trim().toLocaleLowerCase("pt-BR");
  return (Array.isArray(character.resources) ? character.resources : []).find(r => {
    const code = normalizeParserCode(r.code || r.name || r.label);
    return code.toLocaleLowerCase("pt-BR") === wanted || String(r.name || r.label || "").trim().toLocaleLowerCase("pt-BR") === wanted;
  }) || null;
}

function resourceCurrentValue(resource) {
  if (!resource || typeof resource !== "object") return 0;
  const candidates = [resource.current, resource.value, resource.amount, resource.quantity];
  for (const raw of candidates) {
    if (raw === null || raw === undefined || raw === "") continue;
    const n = Number(String(raw).replace(",", "."));
    if (Number.isFinite(n)) return n;
  }
  return 0;
}

function configuredResourceDefinition(resourceCode) {
  const code = normalizeParserCode(resourceCode);
  const configured = Array.isArray(state.table?.configuration?.resources)
    ? state.table.configuration.resources
    : [];
  return configured.find(item =>
    normalizeParserCode(item?.code || item?.name || item?.label) === code
  ) || null;
}

function resolveResourceMaximum(resource, resourceCode, character) {
  const configured = configuredResourceDefinition(resourceCode);
  const rawCandidates = [
    resource?.maxValue,
    resource?.maximum,
    resource?.max,
    resource?.limit,
    configured?.maxValue,
    configured?.maximum,
    configured?.max,
    configured?.limit
  ];

  const directValue = raw => {
    if (raw === null || raw === undefined || raw === "") return null;
    const n = Number(String(raw).replace(",", "."));
    return Number.isFinite(n) ? n : null;
  };

  const valueMapForCharacter = c => {
    const map = {};
    const attrs = Array.isArray(c?.attributes) ? c.attributes : [];
    const resources = Array.isArray(c?.resources) ? c.resources : [];
    attrs.forEach(a => {
      const code = normalizeParserCode(a?.code || a?.name || a?.label);
      const value = Number(String(a?.value ?? a?.current ?? a?.amount ?? 0).replace(",", "."));
      if (code && Number.isFinite(value)) map[code] = value;
    });
    resources.forEach(r => {
      const code = normalizeParserCode(r?.code || r?.name || r?.label);
      const value = Number(String(r?.value ?? r?.current ?? r?.amount ?? 0).replace(",", "."));
      if (code && Number.isFinite(value)) map[code] = value;
    });
    return map;
  };

  const maximumOf = (code, c, seen = new Set()) => {
    const normalized = normalizeParserCode(code);
    if (seen.has(normalized)) return null;
    seen.add(normalized);
    const configuredResource = (Array.isArray(state.table?.configuration?.resources) ? state.table.configuration.resources : [])
      .find(r => normalizeParserCode(r?.code || r?.name || r?.label) === normalized);
    const characterResource = (Array.isArray(c?.resources) ? c.resources : [])
      .find(r => normalizeParserCode(r?.code || r?.name || r?.label) === normalized);
    const raws = [
      characterResource?.maxValue, characterResource?.maximum, characterResource?.max, characterResource?.limit,
      configuredResource?.maxValue, configuredResource?.maximum, configuredResource?.max, configuredResource?.limit
    ];
    for (const raw of raws) {
      const direct = directValue(raw);
      if (direct !== null) return direct;
      if (typeof raw !== "string" || !/^\s*\[.*\]\s*$/.test(raw)) continue;
      const expression = raw.trim().slice(1, -1).replace(/\s+/g, "");
      const tokens = expression.match(/[A-Za-zÀ-ÿ][A-Za-zÀ-ÿ0-9_]*|!!|!|\d+(?:[.,]\d+)?|[+\-*/()]/g);
      if (!tokens || tokens.join("") !== expression) continue;
      const map = valueMapForCharacter(c);
      let js = "";
      let lastCode = null;
      let valid = true;
      for (const token of tokens) {
        if (/^[A-Za-zÀ-ÿ]/.test(token)) {
          lastCode = normalizeParserCode(token);
          if (!Object.prototype.hasOwnProperty.call(map, lastCode)) { valid = false; break; }
          js += String(map[lastCode]);
        } else if (token === "!") {
          if (!lastCode || !Object.prototype.hasOwnProperty.call(map, lastCode)) { valid = false; break; }
          js += String(map[lastCode]);
        } else if (token === "!!") {
          if (!lastCode) { valid = false; break; }
          const nested = maximumOf(lastCode, c, new Set(seen));
          if (!Number.isFinite(nested)) { valid = false; break; }
          js += String(nested);
        } else {
          js += token.replace(",", ".");
        }
      }
      if (!valid) continue;
      try {
        const result = Number(Function('"use strict";return (' + js + ')')());
        if (Number.isFinite(result)) return result;
      } catch {}
    }
    return null;
  };

  for (const raw of rawCandidates) {
    const direct = directValue(raw);
    if (direct !== null) return direct;
    if (typeof raw === "string" && /^\s*\[.*\]\s*$/.test(raw)) {
      const result = maximumOf(resourceCode, character || {});
      if (Number.isFinite(result)) return result;
    }
  }
  return maximumOf(resourceCode, character || {});
}
function writeResourceCurrent(resource, value) {
  const next = Number(value);
  if (!resource || !Number.isFinite(next)) return;
  // O character-sheet usa value como campo canônico, mas algumas fichas antigas
  // ainda possuem current/amount. Sincronizamos os campos que já existem.
  const hadValue = Object.prototype.hasOwnProperty.call(resource, "value");
  const hadCurrent = Object.prototype.hasOwnProperty.call(resource, "current");
  const hadAmount = Object.prototype.hasOwnProperty.call(resource, "amount");
  // character-sheet.js uses `value` as the canonical persisted current value.
  // Keep legacy aliases synchronized too, so old sheets cannot silently revert.
  resource.value = next;
  if (hadCurrent) resource.current = next;
  if (hadAmount) resource.amount = next;
}

async function executeResourceCommand(args, mode = "recover") {
  if (!state.isMaster) throw new Error("Somente o mestre pode alterar recursos por comando.");
  const [characterName, resourceName, quantityRaw] = args;
  const commandName = mode === "decrease" ? "decrease" : "recover";
  if (!characterName || !resourceName || !quantityRaw) {
    throw new Error(`Use: &${commandName}{personagem; recurso; quantidade}`);
  }

  const target = await findCharacterTarget(characterName);
  if (!target) throw new Error(`Personagem "${characterName}" não encontrado.`);

  const quantity = Number(String(quantityRaw).trim().replace(",", "."));
  if (!Number.isFinite(quantity) || quantity < 0) {
    throw new Error("A quantidade deve ser um número positivo.");
  }

  // A alteração precisa ser feita sobre a versão MAIS RECENTE da ficha.
  // Nunca usamos o objeto que foi lido antes da transação para calcular o novo
  // valor. Isso evita exatamente o bug: mestre recupera HP -> player rola uma
  // habilidade -> uma leitura antiga de 0/15 sobrescreve o 15/15.
  const ref = doc(db, "tables", state.tableId, "characters", target.member.uid);
  let result = null;
  await runTransaction(db, async transaction => {
    const snap = await transaction.get(ref);
    const character = snap.exists() ? (snap.data() || {}) : {};
    const resource = findCharacterResource(character, resourceName);
    if (!resource) throw new Error(`${characterName} não possui o recurso "${resourceName}".`);

    const code = normalizeParserCode(resource.code || resource.name || resource.label);
    const current = resourceCurrentValue(resource);
    const max = resolveResourceMaximum(resource, code, character);
    const desired = mode === "decrease" ? current - quantity : current + quantity;
    const next = mode === "decrease"
      ? Math.max(0, desired)
      : (Number.isFinite(max) ? Math.min(max, desired) : desired);
    const changed = next - current;
    const absolute = Math.abs(changed);

    writeResourceCurrent(resource, next);
    transaction.set(ref, firestoreSafe({ ...character, uid: target.member.uid, tableId: state.tableId, updatedAt: serverTimestamp() }), { merge: true });
    result = { code, label: resource.name || resource.label || code, unit: resource.unit ? ` ${resource.unit}` : "", absolute, next, max };
  });

  const verb = mode === "decrease" ? "perdeu" : "recuperou";
  await postNPC(`${characterName} ${verb} ${result.absolute}${result.unit} de ${result.label}.`, {
    systemEvent: mode === "decrease" ? "resource-decreased" : "resource-recovered",
    actorUid: state.user.uid,
    targetUid: target.member.uid,
    resourceCode: result.code,
    quantity: result.absolute
  });
}

async function executeRecoverCommand(args) {
  return executeResourceCommand(args, "recover");
}

async function executeDecreaseCommand(args) {
  return executeResourceCommand(args, "decrease");
}

async function executeSetCommand(args) {
  if (!state.isMaster) throw new Error("Somente o mestre pode aplicar estados.");
  const [characterName, stateName, action] = args;
  if (!characterName || !stateName || !action) throw new Error("Use: &set{personagem; estado; on/off} ou &set{personagem; dead}");
  const target = await findCharacterTarget(characterName);
  if (!target) throw new Error(`Personagem "${characterName}" não encontrado.`);
  const normalized = String(action).trim().toLowerCase();
  const ref = target.ref;
  const snap = await getDoc(ref);
  const character = snap.exists() ? (snap.data() || {}) : target.character || {};
  if (String(stateName).trim().toLowerCase() === "dead") {
    await updateDoc(ref, { status: "dead", alive: false, death: { at: serverTimestamp(), byUid: state.user.uid } });
    await postNPC(`${characterName} está morto.\nFoi um prazer lutar ao seu lado!\n🪦R.I.P.`, { systemEvent: "character-killed", actorUid: state.user.uid, targetUid: target.member.uid });
    return;
  }
  if (!["on", "off"].includes(normalized)) throw new Error("O estado deve terminar com on ou off.");
  const key = String(stateName).trim();
  // A ficha trabalha com estados aplicados como uma lista de identificadores/objetos.
  // Mantemos compatibilidade com fichas antigas que eventualmente tenham salvo
  // o campo states como mapa { Estado: true/false }, convertendo apenas o necessário.
  const rawStates = character.states;
  const states = Array.isArray(rawStates)
    ? rawStates.slice()
    : (rawStates && typeof rawStates === "object"
      ? Object.entries(rawStates).filter(([, enabled]) => enabled).map(([name]) => ({ id: name, name }))
      : []);
  const wanted = key.toLocaleLowerCase("pt-BR");
  const matches = value => {
    if (typeof value === "string") return value.trim().toLocaleLowerCase("pt-BR") === wanted;
    if (!value || typeof value !== "object") return false;
    return [value.id, value.name, value.label].filter(Boolean)
      .some(v => String(v).trim().toLocaleLowerCase("pt-BR") === wanted);
  };
  const nextStates = states.filter(value => !matches(value));
  if (normalized === "on") nextStates.push({ id: key, name: key });
  await updateDoc(ref, { states: nextStates, updatedAt: serverTimestamp() });
  await postNPC(normalized === "on" ? `😵‍💫 ${characterName} está ${key}.` : `🙂 ${characterName} não está mais ${key}.`, { systemEvent: "character-state", actorUid: state.user.uid, targetUid: target.member.uid, stateName: key, enabled: normalized === "on" });
}

async function executeGiveCommand(args) {
  if (!state.isMaster) throw new Error("Somente o mestre pode entregar itens por comando.");
  const [characterName, itemName, descriptionRaw, quantityRaw] = args;
  if (!characterName || !itemName || !quantityRaw) throw new Error("Use: &give{personagem; item; descrição; carga}");
  const target = await findCharacterTarget(characterName);
  if (!target) throw new Error(`Personagem "${characterName}" não encontrado.`);
  const member = target.member;
  const character = target.character;
  const parsed = parseInventoryQuantity(quantityRaw);
  if (!parsed) {
    const system = equipmentLoadSystem();
    const expected = system === "slot" ? "1 ou 13/" : `uma quantidade com a unidade configurada (${equipmentUnit() || "unidade da mesa"})`;
    throw new Error(`Quantidade inválida para o sistema de inventário da mesa. Use ${expected}.`);
  }
  const list = characterEquipmentList(character);
  const existing = findCharacterEquipment(character, itemName);
  const configured = configuredEquipmentItem(itemName);
  if (existing) {
    existing.load = Number(existing.load ?? existing.quantity ?? 0) + parsed.value;
    if (equipmentLoadSystem() === "slot") existing.fractional = existing.fractional || parsed.fractional;
    if (descriptionRaw && !String(existing.description || "").trim()) existing.description = descriptionRaw;
  } else {
    list.push({
      id: `equipment_${Date.now()}_${Math.random().toString(36).slice(2,8)}`,
      name: String(itemName).trim(),
      type: configured?.type || configured?.category || equipmentSettings().equipmentTypes?.[0] || "",
      load: parsed.value,
      fractional: equipmentLoadSystem() === "slot" ? parsed.fractional : false,
      value: configured?.value ?? "",
      description: descriptionRaw ? String(descriptionRaw).trim() : String(configured?.description || "")
    });
  }
  await saveCommandCharacter(target, character);
  const qtyLabel = parsed.display;
  await postNPC(`📦 ${characterName} recebeu **${qtyLabel}** de ${itemName}.`, { systemEvent: "item-given", actorUid: state.user.uid, targetUid: member.uid, itemName, quantity: parsed.value });
}

async function executeBreakCommand(args) {
  if (!state.isMaster) throw new Error("Somente o mestre pode quebrar/remover itens por comando.");
  const [characterName, itemName, quantityRaw] = args;
  if (!characterName || !itemName || !quantityRaw) throw new Error("Use: &break{personagem; item; quantidade}");
  const target = await findCharacterTarget(characterName);
  if (!target) throw new Error(`Personagem "${characterName}" não encontrado.`);
  const member = target.member;
  const character = target.character;
  const parsed = parseInventoryQuantity(quantityRaw);
  if (!parsed) throw new Error("Quantidade inválida para o sistema de inventário configurado na mesa.");
  const item = findCharacterEquipment(character, itemName);
  if (!item) throw new Error(`${characterName} não possui "${itemName}".`);
  const current = Number(item.load ?? item.quantity ?? 0);
  const remaining = current - parsed.value;
  if (!Number.isFinite(current) || remaining <= 0) {
    character.equipment = characterEquipmentList(character).filter(x => x !== item);
  } else {
    item.load = remaining;
  }
  await saveCommandCharacter(target, character);
  await postNPC(`💥 ${characterName} perdeu **${parsed.display}** de ${itemName}.`, { systemEvent: "item-broken", actorUid: state.user.uid, targetUid: member.uid, itemName, quantity: parsed.value });
}

async function executeKillCommand(args) {
  if (!state.isMaster) throw new Error("Somente o mestre pode declarar uma morte.");
  const characterName = String(args[0] || "").trim();
  if (!characterName) throw new Error("Use: &kill{personagem}");
  const target = await findCharacterTarget(characterName);
  if (!target) throw new Error(`Personagem "${characterName}" não encontrado.`);
  const member = target.member;
  const ref = target.ref;
  const snap = await getDoc(ref);
  if (!snap.exists()) throw new Error(`${characterName} ainda não possui uma ficha nesta mesa.`);
  await updateDoc(ref, { status: "dead", alive: false, editingAllowed: false, death: { at: serverTimestamp(), byUid: state.user.uid, byName: state.user.displayName || "Mestre" }, updatedAt: serverTimestamp() });
  await postNPC(`☠️ **${characterName}** caiu em combate. A ficha foi preservada como registro da campanha.`, { systemEvent: "character-killed", actorUid: state.user.uid, targetUid: member.uid });
}


function configuredCurrencyName(name) {
  const equipment = state.table?.configuration?.equipmentSettings || state.table?.configuration?.equipment || {};
  if (!equipment.financeEnabled) return null;
  const list = Array.isArray(equipment.currencyTypes) ? equipment.currencyTypes : [];
  const wanted = String(name || "").trim().toLocaleLowerCase("pt-BR");
  return list.find(raw => {
    const label = typeof raw === "object" ? (raw.name || raw.label || raw.code) : raw;
    return String(label || "").trim().toLocaleLowerCase("pt-BR") === wanted;
  }) || null;
}

async function executeCurrencyParser(raw) {
  const match = String(raw || "").trim().match(/^\$([^{};]+)\{\s*([+-]?\d+(?:[.,]\d+)?)\s*;\s*([^{}]+?)\s*\}$/u);
  if (!match) return false;

  const currencyInput = match[1].trim();
  const amount = Number(match[2].replace(",", "."));
  const recipientInput = String(match[3] || "").trim();
  const equipment = state.table?.configuration?.equipmentSettings || state.table?.configuration?.equipment || {};

  if (!equipment.financeEnabled) throw new Error("O sistema financeiro desta mesa está desativado.");
  const currency = configuredCurrencyName(currencyInput);
  if (!currency) throw new Error(`A moeda "${currencyInput}" não está definida nesta mesa.`);
  if (!Number.isFinite(amount) || amount === 0) throw new Error("O valor da transferência deve ser diferente de zero.");
  if (!recipientInput) throw new Error("Informe o personagem destinatário.");

  const entryName = typeof currency === "object" ? (currency.name || currency.label || currency.code) : currency;
  const key = String(entryName || currencyInput).trim();
  const tableRef = doc(db, "tables", state.tableId);
  const isTableRecipient = /^(?:a\s+mesa|mesa)$/iu.test(recipientInput);

  // Mestre: lançamento direto na ficha de outro personagem.
  if (state.isMaster) {
    if (isTableRecipient) throw new Error("O mestre deve informar um personagem destinatário.");
    if (!amount) throw new Error("Valor inválido.");

    const target = await findCharacterTarget(recipientInput);
    if (!target) throw new Error(`Personagem "${recipientInput}" não encontrado.`);
    const targetRef = target.ref;
    const targetSnap = await getDoc(targetRef);
    if (!targetSnap.exists()) throw new Error(`A ficha de "${recipientInput}" não existe.`);
    const character = targetSnap.data() || {};
    const finances = { ...(character.finances || {}) };
    const current = Number(finances[key] ?? 0);
    if (!Number.isFinite(current)) throw new Error(`O saldo atual de ${key} na ficha é inválido.`);
    const next = current + amount;
    if (next < 0) throw new Error(`O saldo de ${key} de ${recipientInput} não pode ficar negativo.`);
    finances[key] = next;
    await setDoc(targetRef, firestoreSafe({ ...character, finances, updatedAt: serverTimestamp() }), { merge: true });

    const verb = amount > 0 ? "creditou" : "debitou";
    await postNPC(`💱 ${memberName(state.user.uid)} ${verb} ${key}: ${Math.abs(amount)} na ficha de ${target.character?.profile?.name || target.character?.name || recipientInput}.`, {
      systemEvent: "currency-transfer", actorUid: state.user.uid, targetUid: target.member.uid,
      privateTo: [state.user.uid, target.member.uid].filter(Boolean), currency: key, quantity: amount
    });
    return true;
  }

  // Player: somente transferência positiva, saindo da própria ficha.
  if (amount < 0) throw new Error("Players só podem transferir valores positivos.");
  if (isTableRecipient) {
    const ownRef = doc(db, "tables", state.tableId, "characters", state.user.uid);
    const ownSnap = await getDoc(ownRef);
    if (!ownSnap.exists()) throw new Error("Você ainda não possui uma ficha nesta mesa.");
    const own = ownSnap.data() || {};
    const ownFinances = { ...(own.finances || {}) };
    const current = Number(ownFinances[key] ?? 0);
    if (!Number.isFinite(current) || current < amount) throw new Error(`Saldo insuficiente de ${key}.`);
    ownFinances[key] = current - amount;
    const tableSnap = await getDoc(tableRef);
    const table = tableSnap.data() || {};
    const tableFinances = { ...(table.finances || {}) };
    const tableCurrent = Number(tableFinances[key] ?? 0);
    if (!Number.isFinite(tableCurrent)) throw new Error(`O saldo de ${key} da mesa é inválido.`);
    tableFinances[key] = tableCurrent + amount;
    await setDoc(ownRef, firestoreSafe({ ...own, finances: ownFinances, updatedAt: serverTimestamp() }), { merge: true });
    await updateDoc(tableRef, { finances: tableFinances });

    const characterName = own.profile?.name || own.name || memberName(state.user.uid) || "Personagem";
    await postNPC(`💱 ${characterName} realizou uma transferência de ${key}: ${amount} para a mesa.`, {
      systemEvent: "currency-transfer", actorUid: state.user.uid, targetUid: state.user.uid,
      privateTo: [state.user.uid, state.table.ownerId].filter(Boolean), currency: key, quantity: amount, recipient: "mesa"
    });
    return true;
  }

  const target = await findCharacterTarget(recipientInput);
  if (!target) throw new Error(`Personagem "${recipientInput}" não encontrado.`);
  if (target.member?.uid === state.user.uid) throw new Error("Você não pode transferir para a própria ficha.");

  const ownRef = doc(db, "tables", state.tableId, "characters", state.user.uid);
  const ownSnap = await getDoc(ownRef);
  if (!ownSnap.exists()) throw new Error("Você ainda não possui uma ficha nesta mesa.");
  const targetSnap = await getDoc(target.ref);
  if (!targetSnap.exists()) throw new Error(`A ficha de "${recipientInput}" não existe.`);

  const own = ownSnap.data() || {};
  const targetCharacter = targetSnap.data() || {};
  const ownFinances = { ...(own.finances || {}) };
  const targetFinances = { ...(targetCharacter.finances || {}) };
  const ownCurrent = Number(ownFinances[key] ?? 0);
  const targetCurrent = Number(targetFinances[key] ?? 0);
  if (!Number.isFinite(ownCurrent) || ownCurrent < amount) throw new Error(`Saldo insuficiente de ${key}.`);
  if (!Number.isFinite(targetCurrent)) throw new Error(`O saldo atual de ${key} do destinatário é inválido.`);

  ownFinances[key] = ownCurrent - amount;
  targetFinances[key] = targetCurrent + amount;
  await setDoc(ownRef, firestoreSafe({ ...own, finances: ownFinances, updatedAt: serverTimestamp() }), { merge: true });
  await setDoc(target.ref, firestoreSafe({ ...targetCharacter, finances: targetFinances, updatedAt: serverTimestamp() }), { merge: true });

  const characterName = own.profile?.name || own.name || memberName(state.user.uid) || "Personagem";
  const recipientName = targetCharacter.profile?.name || targetCharacter.name || recipientInput;
  await postNPC(`💱 ${characterName} realizou uma transferência de ${key}: ${amount} para ${recipientName}.`, {
    systemEvent: "currency-transfer", actorUid: state.user.uid, targetUid: target.member.uid,
    privateTo: [state.user.uid, target.member.uid].filter(Boolean), currency: key, quantity: amount, recipient: recipientName
  });
  return true;
}

async function executeChatCommand(raw) {
  const match = String(raw || "").trim().match(/^&(set|give|recover|break|kill|decrease)\s*\{([\s\S]*)\}$/i);
  if (!match) return false;
  if (!state.isMaster) { toast("Somente o mestre pode usar comandos de mesa.", "error"); return true; }
  const command = match[1].toLowerCase();
  const args = splitCommandArgs(match[2]);
  try {
    if (command === "set") await executeSetCommand(args);
    else if (command === "give") await executeGiveCommand(args);
    else if (command === "break") await executeBreakCommand(args);
    else if (command === "kill") await executeKillCommand(args);
    else if (command === "recover") await executeRecoverCommand(args);
    else await executeDecreaseCommand(args);
    return true;
  } catch (error) {
    console.error("Comando de mesa:", error);
    toast(error.message || "Não foi possível executar o comando.", "error");
    return true;
  }
}

// ============================================================
// ENVIO
// ============================================================

async function notifyTablePush({ text, senderUid = state.user?.uid, senderName = state.user?.displayName || "Usuário", recipientUids = null, type = "message" } = {}) {
  if (!text || !state.tableId || !state.user) return null;

  // A lista de membros do documento da mesa é a fonte de verdade. Removemos
  // duplicados e o próprio remetente antes de chamar a central FCM.
  const sourceIds = Array.isArray(recipientUids)
    ? recipientUids
    : (Array.isArray(state.table?.members) ? state.table.members : []);
  const ids = [...new Set(sourceIds.map(uid => String(uid || "").trim()).filter(uid => uid && uid !== senderUid))];

  console.log("[A Role Play] Push → destinatários:", ids);
  if (!ids.length) {
    console.warn("[A Role Play] Push → nenhum destinatário válido encontrado.", {
      tableId: state.tableId,
      members: state.table?.members || [],
      senderUid
    });
    return { ok: true, sent: 0, reason: "no_recipients" };
  }

  try {
    const result = await sendARolePlayPush({
      tableId: state.tableId,
      tableName: state.table?.name || "A Role Play",
      senderUid,
      senderName,
      body: text,
      recipientUids: ids,
      type
    });
    console.log("[A Role Play] Push → resposta:", result);
    return result;
  } catch (error) {
    // Push nunca pode impedir o envio da mensagem para o Firestore.
    console.warn("[A Role Play] Push da mesa não enviado:", error);
    return null;
  }
}

async function sendText(root) {
  const input = root.querySelector("#rp-input");
  if (!input) return;
  const rawText = input.value.trim();
  if (!rawText) return;

  // Comandos do mestre não dependem do turno e precisam ser consumidos
  // imediatamente. O envio anterior esperava toda a transação do Firestore
  // terminar antes de limpar o input, permitindo vários cliques e acumulando
  // execuções do mesmo comando.
  const isCurrencyParser = /^\$[^{};]+\{\s*[+-]?\d+(?:[.,]\d+)?\s*;\s*[^{}]+?\s*\}$/u.test(rawText);
  if (isCurrencyParser) {
    if (state.sending || state.mutedByTable) {
      if (state.mutedByTable) toast("Você está silenciado nesta mesa.", "error");
      return;
    }
    state.sending = true;
    root.querySelector("#rp-send")?.classList.add("loading");
    input.value = ""; input.style.height = "auto";
    clearTimeout(state.typingTimer); setTyping(false);
    try { await executeCurrencyParser(rawText); }
    catch (error) { console.error("Parser de moeda:", error); toast(error.message || "Não foi possível alterar a moeda.", "error"); }
    finally { state.sending = false; root.querySelector("#rp-send")?.classList.remove("loading"); }
    return;
  }

  const isTableCommand = /^&(set|give|break|kill|recover|decrease)\s*\{[\s\S]*\}$/i.test(rawText);
  if (isTableCommand) {
    if (!state.isMaster) {
      toast("Somente o mestre pode usar comandos de mesa.", "error");
      return;
    }
    if (state.sending || state.mutedByTable) {
      if (state.mutedByTable) toast("Você está silenciado nesta mesa.", "error");
      return;
    }

    state.sending = true;
    root.querySelector("#rp-send")?.classList.add("loading");
    input.value = "";
    input.style.height = "auto";
    clearTimeout(state.typingTimer);
    setTyping(false);

    try {
      await executeChatCommand(rawText);
    } finally {
      state.sending = false;
      root.querySelector("#rp-send")?.classList.remove("loading");
    }
    return;
  }

  if (isTurnMode() && !isUsersTurn()) {
    toast("Aguarde seu turno.", "error");
    return;
  }
  if (state.sending || state.mutedByTable) {
    if (state.mutedByTable) toast("Você está silenciado nesta mesa.", "error");
    return;
  }
  const parserCodes = state.isMaster && !isFreeMode() ? extractParserCodes(rawText) : [];
  const text = parserCodes.length ? stripParserCodes(rawText) : rawText;
  if (!text && !parserCodes.length) return;

  state.sending = true;
  root.querySelector("#rp-send")?.classList.add("loading");
  try {
    await setDoc(doc(collection(db, "tables", state.tableId, "messages")), {
      uid: state.user.uid,
      username: state.user.displayName || "Usuário",
      photoURL: state.user.photoURL || "",
      text,
      parserCodes,
      type: "text",
      authorRole: state.isMaster ? "master" : "player",
      isMaster: state.isMaster,
      createdAtMs: Date.now(),
      createdAt: serverTimestamp()
    });
    input.value = "";
    input.style.height = "auto";
    clearTimeout(state.typingTimer);
    await setTyping(false);
    await updateDoc(doc(db, "tables", state.tableId), {
      lastMessage: text.slice(0, 120),
      lastMessageAt: serverTimestamp()
    }).catch(() => {});
    await bumpUnread(state.user.uid);
    await notifyTablePush({ text, senderUid: state.user.uid, senderName: state.user.displayName || "Usuário", type: "message" });
  } catch (error) {
    console.error("Erro ao enviar mensagem:", error);
    toast(error.code === "permission-denied" ? "Você não tem permissão para enviar mensagens." : "Não foi possível enviar a mensagem.", "error");
  } finally {
    state.sending = false;
    root.querySelector("#rp-send")?.classList.remove("loading");
  }
}

async function handlePhoto(root, file) {
  const input = root.querySelector("#rp-photo-input");
  if (isTurnMode() && !isUsersTurn()) {
    toast("Aguarde seu turno.", "error");
    input.value = "";
    return;
  }
  if (!file || state.imageBusy) return;
  if (state.mutedByTable) {
    toast("Você está silenciado nesta mesa.", "error");
    input.value = "";
    return;
  }

  state.imageBusy = true;
  try {
    toast("Preparando foto...", "info");
    const dataUrl = await imageFileToDataURL(file);
    await setDoc(doc(collection(db, "tables", state.tableId, "messages")), {
      uid: state.user.uid,
      username: state.user.displayName || "Usuário",
      photoURL: state.user.photoURL || "",
      type: "image",
      imageData: dataUrl,
      text: "",
      authorRole: state.isMaster ? "master" : "player",
      isMaster: state.isMaster,
      createdAtMs: Date.now(),
      createdAt: serverTimestamp()
    });
    await updateDoc(doc(db, "tables", state.tableId), {
      lastMessage: "📷 Foto",
      lastMessageAt: serverTimestamp()
    }).catch(() => {});
    await bumpUnread(state.user.uid);
    await notifyTablePush({ text: "📷 Foto", senderUid: state.user.uid, senderName: state.user.displayName || "Usuário", type: "image" });
  } catch (error) {
    console.error("Erro ao enviar foto:", error);
    toast(error.message || "Não foi possível enviar a foto.", "error");
  } finally {
    state.imageBusy = false;
    input.value = "";
  }
}

// ============================================================
// QUICK DIAL
// ============================================================

function bindQuickDial(root) {
  root.querySelectorAll(".rp-quick-item").forEach(button => {
    button.addEventListener("click", () => {
      const action = button.dataset.action;
      if (action === "dice") openDiceRoller(root);
      if (action === "sheet") openSheet(root);
      if (action === "turn") finishTurn(root);
    });
  });
}

function openQuickDial(root) {
  state.quickOpen = true;
  root.querySelector("#rp-quick-dial")?.classList.add("open");
}

function closeQuickDial(root) {
  state.quickOpen = false;
  root.querySelector("#rp-quick-dial")?.classList.remove("open");
}

function bindComposerGesture(root) {
  const send = root.querySelector("#rp-send");
  const dial = root.querySelector("#rp-quick-dial");
  if (!send || !dial) return;

  let startY = 0;
  let tracking = false;
  let draggedToOpen = false;

  send.addEventListener("pointerdown", event => {
    startY = event.clientY;
    tracking = true;
    draggedToOpen = false;
    send.setPointerCapture?.(event.pointerId);
  });
  send.addEventListener("pointermove", event => {
    if (!tracking) return;
    const dy = event.clientY - startY;
    if (dy < -18) {
      draggedToOpen = true;
      openQuickDial(root);
    }
  });
  send.addEventListener("pointerup", event => {
    if (!tracking) return;
    const dy = event.clientY - startY;
    tracking = false;
    if (!draggedToOpen && dy >= -18 && !state.quickOpen) sendText(root);
  });
  send.addEventListener("pointercancel", () => { tracking = false; });

  let dialStartY = 0;
  let dialTracking = false;
  let dialClosedByGesture = false;
  dial.addEventListener("pointerdown", event => {
    dialStartY = event.clientY;
    dialTracking = true;
    dialClosedByGesture = false;
    dial.setPointerCapture?.(event.pointerId);
  });
  dial.addEventListener("pointermove", event => {
    if (!dialTracking || !state.quickOpen) return;
    if (event.clientY - dialStartY > 22) {
      dialClosedByGesture = true;
      closeQuickDial(root);
    }
  });
  dial.addEventListener("pointerup", () => { dialTracking = false; });
  dial.addEventListener("pointercancel", () => { dialTracking = false; });
}

function diceSVG(sides) {
  if (sides === 2) return renderSVG_D2();
  if (sides === 4) return renderSVG_D4();
  if (sides === 6) return renderSVG_D6();
  if (sides === 8) return renderSVG_D8();
  if (sides === 10) return renderSVG_D10();
  if (sides === 12) return renderSVG_D12();
  if (sides === 20) return renderSVG_D20();
  if (sides === 100) return `<div class="rp-d100-double"><span>${renderSVG_D10()}</span><span>${renderSVG_D10()}</span></div>`;
  return renderSVG_D20();
}

function availableDice() {
  const configured = state.table?.configuration?.dice || [];
  return configured.map(d => Number(typeof d === "object" ? d.sides : d)).filter(Boolean).filter((v,i,a)=>a.indexOf(v)===i).sort((a,b)=>a-b);
}

function rollOne(sides) {
  return Math.floor(Math.random() * sides) + 1;
}

function addRollDeclaration(item) {
  const existing = state.rollDeclarations.find(d => d.kind === item.kind && d.id === item.id && d.sides === item.sides);
  if (existing) existing.qty += 1;
  else state.rollDeclarations.push({ ...item, qty: 1 });
}

function removeRollDeclaration(index) {
  const item = state.rollDeclarations[index];
  if (!item) return;
  if (item.qty > 1) item.qty -= 1;
  else state.rollDeclarations.splice(index, 1);
}

function rollValueMap() {
  const character = characterDataForRoll();
  const map = {};
  const attrs = Array.isArray(character.attributes) ? character.attributes : [];
  attrs.forEach((attr, index) => {
    const code = normalizeParserCode(attr?.code || attr?.name || `attribute_${index}`);
    const value = Number(attr?.value ?? attr?.current ?? attr?.amount ?? 0);
    if (code && Number.isFinite(value)) map[code] = value;
  });
  return map;
}

function configuredAttributeValue(code) {
  return rollValueMap()[normalizeParserCode(code)] ?? 0;
}

function parserHighlight(text = "") {
  const valid = new Set(configuredAttributes().map(a => a.code));
  return esc(String(text)).replace(/\/([A-Za-z0-9]{1,3})/g, (full, raw) => {
    const code = normalizeParserCode(raw);
    return valid.has(code) ? `<span class="rp-parser-highlight">/${esc(code)}</span>` : full;
  }).replace(/\n/g, "<br>");
}

function declarationAttributeBonus(item) {
  const active = getActiveParserCodes();
  const codes = itemParserCodes(item);
  const effects = parseDeclarationAttributeEffects(item);
  let total = 0;
  codes.forEach(code => {
    if (active.length && !active.includes(code)) return;
    // Atributo declarado usa o valor da ficha. Equipamentos/habilidades/perícias
    // só concedem o bônus explicitamente escrito no parser, como [FOR+1].
    if (item?.kind === "attribute") {
      total += configuredAttributeValue(code);
    } else {
      total += effects[code] || 0;
    }
  });
  return total;
}

function declarationBonusDetails(item) {
  const active = getActiveParserCodes();
  const attrParsers = declarationAttributeParserDetails(item);
  if (item?.kind !== "attribute") {
    return attrParsers
      .filter(detail => !active.length || active.includes(detail.code))
      .map(detail => {
        const attr = findAttribute(detail.code);
        return { code: detail.code, name: attr?.name || detail.code, base: configuredAttributeValue(detail.code), extra: detail.delta, total: configuredAttributeValue(detail.code) + (Number(detail.delta) || 0), expression: detail.expression };
      });
  }
  const codes = itemParserCodes(item);
  return codes.filter(code => !active.length || active.includes(code)).map(code => {
    const attr = findAttribute(code);
    const base = configuredAttributeValue(code);
    const sign = base >= 0 ? "+" : "";
    return { code, name: attr?.name || code, base, extra: base, total: base, expression: `[${code}${sign}${base}]` };
  });
}

function resourceCostDisplay(cost) {
  if (cost == null || cost === "") return "Nenhum";
  if (Array.isArray(cost)) {
    const values = cost.filter(v => v != null && v !== "").map(v => String(v));
    return values.length ? values.join(" · ") : "Nenhum";
  }
  if (typeof cost === "object") {
    return Object.entries(cost).filter(([code, value]) => code && value != null && value !== "").map(([code, value]) => `${code}: ${value}`).join(" · ") || "Nenhum";
  }
  return String(cost);
}

function firestoreSafe(value) {
  if (value === undefined) return null;
  if (Array.isArray(value)) return value.map(firestoreSafe);
  if (value && typeof value === "object") {
    const out = {};
    Object.entries(value).forEach(([key, val]) => {
      if (val !== undefined) out[key] = firestoreSafe(val);
    });
    return out;
  }
  return value;
}

function declarationPills(modal) {
  const box = modal.querySelector("#rp-roll-declarations");
  if (!box) return;
  box.innerHTML = state.rollDeclarations.length ? state.rollDeclarations.map((item, index) => {
    const label = item.kind === "dice" ? `${item.qty}× D${item.sides}` : `${item.qty}× ${item.name}`;
    return `<button type="button" class="rp-roll-pill rp-pill-${esc(item.kind)}" data-remove-declaration="${index}">${esc(label)}</button>`;
  }).join("") : `<span class="rp-roll-empty">Nenhum dado, equipamento, habilidade ou perícia declarado.</span>`;
  box.querySelectorAll("[data-remove-declaration]").forEach(btn => btn.addEventListener("click", () => {
    removeRollDeclaration(Number(btn.dataset.removeDeclaration));
    declarationPills(modal);
  }));
}

function characterDataForRoll() {
  return state.rollCharacter || {};
}

function declarationItemIdentity(item) {
  if (!item || typeof item !== "object") return [];
  return [item.id, item.code, item.key, item.name, item.label]
    .filter(v => v != null && String(v).trim() !== "")
    .map(v => String(v).trim().toUpperCase());
}

function mergeDeclarationItem(characterItem, configItem, kind, index = 0) {
  const c = characterItem && typeof characterItem === "object" ? characterItem : {};
  const t = configItem && typeof configItem === "object" ? configItem : {};
  // A ficha é a fonte de verdade para o estado e para os valores editáveis pelo jogador.
  // A configuração da mesa só completa metadados ausentes.
  const merged = { ...t, ...c };
  const preferCharacter = [
    "name", "description", "cost", "costs", "formula", "effect", "effects",
    "modifiers", "bonuses", "attributeBonuses", "rules", "properties",
    "type", "kind", "category", "fractional", "quantity", "load"
  ];
  preferCharacter.forEach(key => {
    if (Object.prototype.hasOwnProperty.call(c, key)) merged[key] = c[key];
    else if (Object.prototype.hasOwnProperty.call(t, key)) merged[key] = t[key];
  });
  merged.id = c.id || c.code || t.id || t.code || `${kind}_${index}`;
  merged.name = c.name || c.label || t.name || t.label || "Sem nome";
  merged.description = Object.prototype.hasOwnProperty.call(c, "description") ? String(c.description ?? "") : String(t.description ?? "");
  if (kind === "ability") {
    merged.cost = Object.prototype.hasOwnProperty.call(c, "cost") ? c.cost : (t.cost ?? "");
  }
  merged.attributeCodes = declarationAttributeCodes(merged);
  return merged;
}

function configuredDeclarationItems(kind) {
  const config = state.table?.configuration || {};
  const character = characterDataForRoll() || {};
  const configItems = kind === "equipment"
    ? (Array.isArray(config.equipment) ? config.equipment : [])
    : kind === "ability" ? (Array.isArray(config.abilities) ? config.abilities : [])
    : (Array.isArray(config.skills) ? config.skills : []);
  const charItems = kind === "equipment"
    ? (Array.isArray(character.equipment) ? character.equipment : [])
    : kind === "ability" ? (Array.isArray(character.abilities) ? character.abilities : [])
    : (Array.isArray(character.skills) ? character.skills : []);

  const configById = new Map();
  configItems.forEach((item, index) => {
    if (typeof item === "string") {
      configById.set(`${kind}_${index}`, { id: `${kind}_${index}`, name: item });
      return;
    }
    declarationItemIdentity(item).forEach(key => configById.set(key, item));
  });

  const usedConfig = new Set();
  const resolved = [];
  charItems.forEach((item, index) => {
    if (typeof item === "string") {
      resolved.push(mergeDeclarationItem({ name: item }, null, kind, index));
      return;
    }
    const keys = declarationItemIdentity(item);
    const cfg = keys.map(key => configById.get(key)).find(Boolean) || null;
    if (cfg) declarationItemIdentity(cfg).forEach(key => usedConfig.add(key));
    resolved.push(mergeDeclarationItem(item, cfg, kind, index));
  });

  // Itens definidos pela mesa que ainda não possuem uma cópia na ficha também
  // continuam declaraveis, mas nunca substituem a cópia existente da ficha.
  configItems.forEach((item, index) => {
    if (typeof item === "string") {
      const key = `${kind}_${index}`.toUpperCase();
      if (!resolved.some(x => declarationItemIdentity(x).includes(key))) resolved.push(mergeDeclarationItem(null, { id: `${kind}_${index}`, name: item }, kind, index));
      return;
    }
    const keys = declarationItemIdentity(item);
    if (!keys.some(key => usedConfig.has(key)) && !resolved.some(x => keys.some(key => declarationItemIdentity(x).includes(key)))) {
      resolved.push(mergeDeclarationItem(null, item, kind, resolved.length));
    }
  });

  return resolved;
}

function openAttributePicker(parentModal) {
  const attrs = configuredAttributes();
  const allowed = getActiveParserCodes();
  const picker = openModal("Declarar atributo", `<div class="rp-declaration-picker rp-attribute-picker">${allowed.length ? `<div class="rp-parser-context"><span>Permitidos nesta ação</span>${allowed.map(code => `<b>/${esc(code)}</b>`).join("")}</div>` : ""}${attrs.length ? attrs.map(attr => {
    const disabled = allowed.length && !allowed.includes(attr.code);
    return `<button type="button" class="rp-declaration-option rp-attribute-option${disabled ? " rp-declaration-disabled" : ""}" data-declare-attribute="${esc(attr.code)}" ${disabled ? "disabled aria-disabled=\"true\"" : ""}><span>${esc(attr.name)}</span><small>${esc(attr.code)}: ${esc(configuredAttributeValue(attr.code))}</small></button>`;
  }).join("") : `<div class="rp-empty">Nenhum atributo configurado.</div>`}</div>`, () => openDiceRoller(false));
  picker.querySelectorAll("[data-declare-attribute]:not(:disabled)").forEach(btn => btn.addEventListener("click", () => {
    const attr = attrs.find(x => x.code === btn.dataset.declareAttribute);
    if (!attr) return;
    addRollDeclaration({ kind: "attribute", id: attr.id, name: attr.name, attributeCodes: [attr.code], value: configuredAttributeValue(attr.code) });
    openDiceRoller(false);
  }));
}

function openDeclarationPicker(kind, parentModal) {
  const labels = { equipment: "Declarar equipamento", ability: "Declarar habilidade", skill: "Declarar perícia" };
  const allItems = configuredDeclarationItems(kind);
  const allowed = getActiveParserCodes();
  const picker = openModal(labels[kind], `<div class="rp-declaration-picker">${allowed.length ? `<div class="rp-parser-context"><span>Permitidos nesta ação</span>${allowed.map(code => `<b>/${esc(code)}</b>`).join("")}</div>` : ""}${allItems.length ? allItems.map(item => {
    const restricted = declarationIsRestricted({ ...item, kind });
    const costState = kind === "ability" ? declarationCostAvailability({ ...item, kind }) : { ok: true, insufficient: [] };
    const disabled = restricted || !costState.ok;
    const description = parserHighlight(item.description || "");
    const details = declarationBonusDetails({ ...item, kind });
    const bonusText = details.length ? details.map(d => `${d.name}: ${d.total}`).join(" · ") : "Sem atributo somável";
    return `<button type="button" class="rp-declaration-option rp-${esc(kind)}-option${disabled ? " rp-declaration-disabled" : ""}" data-declare-id="${esc(item.id)}" ${disabled ? "disabled aria-disabled=\"true\"" : ""}><div class="rp-declaration-main"><span>${esc(item.name)}</span>${kind === "ability" && (item.type || item.kind || item.category) ? `<small class="rp-declaration-type">${esc(item.type || item.kind || item.category)}</small>` : ""}</div>${description ? `<div class="rp-declaration-description">${description}</div>` : ""}<small class="rp-declaration-bonus">${esc(bonusText)}</small>${kind === "ability" ? `<div class="rp-declaration-cost">Custo: ${esc(resourceCostDisplay(item.cost))}</div>` : ""}${restricted ? `<small class="rp-declaration-restriction">Não atende à restrição atual</small>` : ""}${!costState.ok ? `<small class="rp-declaration-restriction">Recurso insuficiente: ${esc(costState.insufficient.map(x => `${x.code} ${x.current}/${x.required}`).join(" · "))}</small>` : ""}</button>`;
  }).join("") : `<div class="rp-empty">Nenhum item configurado.</div>`}</div>`, () => openDiceRoller(false));
  picker.querySelectorAll("[data-declare-id]:not(:disabled)").forEach(btn => btn.addEventListener("click", () => {
    const item = allItems.find(x => x.id === btn.dataset.declareId);
    if (!item) return;
    if (kind === "ability") {
      const costState = declarationCostAvailability({ ...item, kind });
      if (!costState.ok) {
        toast(`Recurso insuficiente: ${costState.insufficient.map(x => `${x.code} ${x.current}/${x.required}`).join(" · ")}`, "error");
        return;
      }
    }
    if (declarationIsRestricted({ ...item, kind })) {
      toast("Esta declaração não atende à restrição atual.", "error");
      return;
    }
    addRollDeclaration({ kind, id: item.id, name: item.name, description: item.description || "", cost: item.cost || "", type: item.type || item.kind || item.category || "", fractional: !!item.fractional, quantity: item.quantity ?? item.load ?? 1, attributeCodes: item.attributeCodes || declarationAttributeCodes(item) });
    openDiceRoller(false);
  }));
}

async function openDiceRoller(reset = true) {
  try { await loadRollCharacter(); } catch (error) { console.warn("Não foi possível atualizar a ficha antes da declaração.", error); }
  if (reset) state.rollDeclarations = [];
  const allowed = getActiveParserCodes();
  const config = state.table?.configuration || {};
  const hasEquipment = config.equipmentSettings?.enabled !== false;
  const hasAbilities = Array.isArray(config.abilities) && config.abilities.length;
  const hasSkills = Array.isArray(config.skills) && config.skills.length;
  const modal = openModal("Rolagem de dados", `<div class="rp-dice-modal">${allowed.length ? `<div class="rp-parser-context rp-roll-context"><span>O mestre restringiu esta rolagem a:</span>${allowed.map(code => `<b>/${esc(code)}</b>`).join("")}</div>` : ""}
    <div class="rp-roll-layout">
      <section class="rp-roll-section"><div class="rp-roll-section-title">Dados</div><div class="rp-dice-grid rp-dice-roll-grid">
        ${availableDice().map(sides => `<button class="rp-die-option" data-add-die="${sides}" type="button"><div class="rp-die-visual">${diceSVG(sides)}</div><strong>D${sides}</strong></button>`).join("") || `<div class="rp-empty">O mestre ainda não configurou dados para esta mesa.</div>`}
      </div></section>
      <section class="rp-roll-section"><div class="rp-roll-section-title">Pool</div><div class="rp-roll-declaration-box"><div id="rp-roll-declarations"></div></div></section>
      ${configuredAttributes().length ? `<section class="rp-roll-section"><div class="rp-roll-section-title">Declarar atributo</div><button type="button" data-declare-kind="attribute" class="rp-declare attribute">＋ Declarar atributo</button></section>` : ""}
      ${hasAbilities ? `<section class="rp-roll-section"><div class="rp-roll-section-title">Declarar habilidade</div><button type="button" data-declare-kind="ability" class="rp-declare ability">＋ Declarar habilidade</button></section>` : ""}
      ${hasEquipment ? `<section class="rp-roll-section"><div class="rp-roll-section-title">Declarar equipamento</div><button type="button" data-declare-kind="equipment" class="rp-declare equipment">＋ Declarar equipamento</button></section>` : ""}
      ${hasSkills ? `<section class="rp-roll-section"><div class="rp-roll-section-title">Declarar perícia</div><button type="button" data-declare-kind="skill" class="rp-declare skill">＋ Declarar perícia</button></section>` : ""}
      <button class="rp-primary rp-roll-submit" id="rp-roll-submit" type="button">Rolar</button>
    </div>
  </div>`);
  declarationPills(modal);
  modal.querySelectorAll("[data-add-die]").forEach(btn => btn.addEventListener("click", () => {
    addRollDeclaration({ kind: "dice", id: `d${btn.dataset.addDie}`, sides: Number(btn.dataset.addDie), name: `D${btn.dataset.addDie}` });
    declarationPills(modal);
  }));
  modal.querySelectorAll("[data-declare-kind]").forEach(btn => btn.addEventListener("click", () => {
    const kind = btn.dataset.declareKind;
    if (kind === "attribute") openAttributePicker(modal);
    else openDeclarationPicker(kind, modal);
  }));
  modal.querySelector("#rp-roll-submit")?.addEventListener("click", () => submitRoll(modal));
}

async function persistRollCharacter(character) {
  const activeNpcRef = activeRollCharacterRef();
  if (activeNpcRef) {
    await setDoc(activeNpcRef, character, { merge: true });
    return;
  }
  const primary = doc(db, "tables", state.tableId, "characters", state.user.uid);
  const primarySnap = await getDoc(primary);
  if (primarySnap.exists()) {
    await setDoc(primary, character, { merge: true });
    return;
  }
  const alt = doc(db, "users", state.user.uid, "characterSheets", state.tableId);
  const altSnap = await getDoc(alt);
  if (altSnap.exists()) await setDoc(alt, character, { merge: true });
}

function numericCurrent(obj) {
  const raw = obj?.value ?? obj?.current ?? obj?.amount ?? 0;
  const n = Number(String(raw).replace(",", "."));
  return Number.isFinite(n) ? n : 0;
}

async function applyDeclarationCharacterChanges(declarations, payload) {
  if (!declarations.length) return;

  // CRÍTICO: custo e efeito de uma habilidade são aplicados ATOMICAMENTE na
  // ficha que está no Firestore agora. Não usamos state.rollCharacter para
  // gravar a ficha, porque esse estado pode estar alguns milissegundos atrás
  // do que o mestre acabou de fazer.
  const ref = activeRollCharacterRef() || doc(db, "tables", state.tableId, "characters", state.user.uid);
  let committedCharacter = null;

  try {
    await runTransaction(db, async transaction => {
      const snap = await transaction.get(ref);
      if (!snap.exists()) throw new Error("Ficha do personagem não encontrada.");

      const character = structuredClone(snap.data() || {});
      character.attributes = Array.isArray(character.attributes) ? character.attributes : [];
      character.resources = Array.isArray(character.resources) ? character.resources : [];
      character.equipment = Array.isArray(character.equipment) ? character.equipment : [];

      const resourceDeltas = {};
      const requiredCosts = {};
      payload.forEach(item => {
        const qty = Number(item.qty) || 1;
        Object.entries(item.costs || {}).forEach(([code, delta]) => {
          const amount = Math.abs(Number(delta) || 0) * qty;
          if (amount > 0) requiredCosts[normalizeParserCode(code)] = (requiredCosts[normalizeParserCode(code)] || 0) + amount;
        });
      });

      // Valida o custo contra a ficha fresca dentro da mesma transação. Assim,
      // nem uma recuperação do mestre nem outra ação simultânea pode fazer uma
      // habilidade gastar/recriar um valor baseado numa leitura antiga.
      for (const [code, required] of Object.entries(requiredCosts)) {
        const resource = character.resources.find(item => normalizeParserCode(item?.code || item?.name || item?.label) === code);
        const current = resourceCurrentValue(resource);
        if (!resource || current + 1e-9 < required) {
          throw new Error(`Recurso insuficiente: ${code}. Necessário ${required}, disponível ${current}.`);
        }
      }

      payload.forEach(item => {
        const qty = Number(item.qty) || 1;
        Object.entries(item.resourceEffects || {}).forEach(([code, delta]) => {
          resourceDeltas[code] = (resourceDeltas[code] || 0) + Number(delta || 0) * qty;
        });
        Object.entries(item.costs || {}).forEach(([code, delta]) => {
          resourceDeltas[code] = (resourceDeltas[code] || 0) + Number(delta || 0) * qty;
        });

        if (item.kind === "equipment" && item.fractional) {
          const eq = character.equipment.find(e => String(e.id || e.code || e.name) === String(item.declarationId));
          if (eq) {
            const field = Object.prototype.hasOwnProperty.call(eq, "quantity") ? "quantity" : Object.prototype.hasOwnProperty.call(eq, "load") ? "load" : null;
            if (field) {
              const current = Number(String(eq[field] ?? 0).replace(",", "."));
              if (Number.isFinite(current)) eq[field] = Math.max(0, current - qty);
            }
          }
        }
      });

      character.resources.forEach(resource => {
        const code = normalizeParserCode(resource.code || resource.name || resource.label);
        const delta = Number(resourceDeltas[code]);
        if (!code || !Number.isFinite(delta) || delta === 0) return;

        const current = resourceCurrentValue(resource);
        const max = resolveResourceMaximum(resource, code, character);
        const nextRaw = current + delta;
        const next = Number.isFinite(max) ? Math.min(max, Math.max(0, nextRaw)) : Math.max(0, nextRaw);
        writeResourceCurrent(resource, next);
      });

      character.updatedAt = serverTimestamp();
      transaction.set(ref, firestoreSafe(character), { merge: true });
      committedCharacter = character;
    });

    state.rollCharacter = committedCharacter || state.rollCharacter;
  } catch (error) {
    console.error("Não foi possível atualizar a ficha após a declaração:", error);
    throw error;
  }
}

async function submitRoll(modal) {
  if (state.rollSubmitting) return;
  if (!modal || !document.body.contains(modal)) return;
  if (isTurnMode() && !isUsersTurn()) return toast("Aguarde seu turno.", "error");
  if (state.mutedByTable) return toast("Você está silenciado nesta mesa.", "error");
  const dice = state.rollDeclarations.filter(d => d.kind === "dice");
  const declarations = state.rollDeclarations.filter(item => item.kind !== "dice" && declarationMatchesParsers(item));
  if (!dice.length && !declarations.length) return toast("Declare pelo menos um dado, atributo, equipamento, habilidade ou perícia.", "error");
  state.rollSubmitting = true;
  await loadRollCharacter();
  const submitButton = modal.querySelector("#rp-roll-submit");
  if (submitButton) { submitButton.disabled = true; submitButton.dataset.submitting = "1"; }
  const insufficient = declarations.filter(item => item.kind === "ability").flatMap(item => {
    const stateCost = declarationCostAvailability(item);
    return stateCost.ok ? [] : stateCost.insufficient.map(entry => ({ item, ...entry }));
  });
  if (insufficient.length) {
    state.rollSubmitting = false;
    if (submitButton) { submitButton.disabled = false; delete submitButton.dataset.submitting; }
    const first = insufficient[0];
    return toast(`Recurso insuficiente: ${first.code}. Necessário ${first.required}, disponível ${first.current}.`, "error");
  }
  const rolls = [];
  let total = 0;
  const rollDie = (sides, label = `D${sides}`) => {
    if (sides === 100) {
      const tens = rollOne(10) - 1;
      const ones = rollOne(10) - 1;
      const value = tens * 10 + ones || 100;
      rolls.push({ label, value });
      total += value;
    } else {
      const value = rollOne(sides);
      rolls.push({ label, value });
      total += value;
    }
  };
  dice.forEach(die => {
    for (let i = 0; i < die.qty; i++) {
      rollDie(die.sides, `D${die.sides}`);
    }
  });
  declarations.forEach(item => {
    parseDeclarationDice(item).forEach(extra => {
      for (let i = 0; i < extra.qty * (Number(item.qty) || 1); i++) rollDie(extra.sides, `D${extra.sides}`);
    });
  });
  const declarationPayload = declarations.map(item => firestoreSafe({
    kind: item.kind, name: item.name, qty: Number(item.qty) || 1, sides: item.sides ?? null,
    attributeCodes: item.attributeCodes || declarationAttributeCodes(item) || [],
    bonus: Number(declarationAttributeBonus(item)) || 0,
    bonusDetails: declarationBonusDetails(item) || [],
    resourceEffects: parseDeclarationResourceEffects(item) || {},
    costs: parseDeclarationCosts(item) || {},
    diceEffects: parseDeclarationDice(item) || [],
    fractional: !!item.fractional,
    declarationId: item.id ?? null
  }));
  const declarationBonus = declarationPayload.reduce((sum, item) => sum + (Number(item.bonus) || 0) * (Number(item.qty) || 1), 0);
  total += declarationBonus;

  try {
    await applyDeclarationCharacterChanges(declarations, declarationPayload);
  } catch (error) {
    state.rollSubmitting = false;
    if (submitButton) { submitButton.disabled = false; delete submitButton.dataset.submitting; }
    return toast("A habilidade não foi executada porque a ficha não pôde ser atualizada com segurança.", "error");
  }
  closeModal();

  // Formato compacto e explícito do resultado, igual ao usado na mesa:
  // 6 + [FOR+3] + [DES+3] + [FOR+1]
  // declarações: 1d20(6), Força([FOR+3]), Arco Recurvo([DES+3][FOR+1])
  // Somente os dados escolhidos diretamente no pool aparecem como resultado
  // principal. Dados/parsers adicionais, quando existirem, não devem quebrar
  // o layout nem duplicar o valor exibido na primeira linha.
  const baseDiceCount = dice.reduce((sum, die) => sum + (Number(die.qty) || 1), 0);
  const rollParts = rolls.slice(0, baseDiceCount).map(r => String(r.value));
  const bonusParts = [];
  const declarationLabels = [];
  let rollCursor = 0;
  const declarationRollCounts = declarationPayload.map(item => {
    const extras = parseDeclarationDice(item).reduce((sum, die) => sum + die.qty, 0) * (Number(item.qty) || 1);
    return extras;
  });
  let explicitDiceConsumed = 0;
  const baseDiceDeclarations = dice.flatMap(die => {
    const qty = Number(die.qty) || 1;
    for (let i = 0; i < qty; i++) rollCursor++;
    return [`${qty}x D${die.sides}`];
  });

  // Dice declarados diretamente entram primeiro; dados gerados por parsers continuam
  // sendo parte do resultado, mas não criam uma declaração duplicada.
  const allDeclarationLabels = [...baseDiceDeclarations];
  declarationPayload.forEach((item, itemIndex) => {
    const details = (item.bonusDetails || []).filter(detail => Number.isFinite(Number(detail.total)));
    details.forEach(detail => {
      const totalBonus = Number(detail.total) || 0;
      if (totalBonus === 0) return;
      // Display the parser exactly as declared by the item, not a reconstructed
      // expression. [DES+3] must remain [DES+3]; it means 0+3.
      bonusParts.push(detail.expression || `[${detail.code}${totalBonus >= 0 ? "+" : ""}${totalBonus}]`);
    });
    const parserText = details.filter(detail => (Number(detail.total) || 0) !== 0)
      .map(detail => detail.expression || `[${detail.code}${Number(detail.total) >= 0 ? "+" : ""}${Number(detail.total)}]`).join("");
    const qty = Number(item.qty) || 1;
    for (let i = 0; i < qty; i++) {
      allDeclarationLabels.push(`${item.name}${parserText}`);
    }
    explicitDiceConsumed += declarationRollCounts[itemIndex] || 0;
  });

  // A rolagem pode conter dados extras vindos de declarações. Eles aparecem na
  // primeira linha como valores efetivamente rolados, sem alterar o texto das
  // declarações selecionadas.
  const poolText = rolls.map(r => String(r.value)).join(" + ");
  const declarationText = allDeclarationLabels.join(" • ");
  const detailExpression = [poolText, bonusParts.join(" + ")].filter(Boolean).join(" + ");
  const detailText = detailExpression;

  try {
    await setDoc(doc(collection(db, "tables", state.tableId, "messages")), firestoreSafe({
      uid: "NPC", username: "NPC", text: `${memberName(state.user.uid)} rolou ${total}.`, type: "bot", authorRole: "bot",
      roll: { rollerUid: state.user.uid, total, details: detailText, declarations: declarationPayload, privateTo: [state.user.uid, state.table.ownerId].filter(Boolean) },
      createdAtMs: Date.now(),
      createdAt: serverTimestamp()
    }));
    await updateDoc(doc(db, "tables", state.tableId), { lastMessage: `🎲 ${memberName(state.user.uid)} rolou ${total}.`, lastMessageAt: serverTimestamp() }).catch(() => {});
    await bumpUnread();
    void notifyTablePush({
      text: `🎲 ${memberName(state.user.uid)} rolou ${total}.`,
      senderUid: state.user.uid,
      senderName: memberName(state.user.uid),
      recipientUids: [state.table.ownerId, state.user.uid].filter(Boolean),
      type: "roll"
    });
  } catch (error) { console.error(error); toast("Não foi possível registrar a rolagem.", "error"); }
  finally {
    state.rollSubmitting = false;
  }
}

function openSheet() {
  navigate(`/character-sheet/${encodeURIComponent(state.tableId)}`);
}

async function postNPC(text, extra = {}) {
  const icons = {
    "item-given": "📦", "item-broken": "💥", "character-killed": "☠️", "resource-recovered": "✦",
    "member-added": "👥", "member-kicked": "🚪", "table-settings-changed": "⚙️",
    "turn-finished": "⏭️"
  };
  const prefix = icons[extra.systemEvent] || (extra.systemEvent ? "✦" : "🎲");
  const botText = `${prefix} ${text}`;
  await setDoc(doc(collection(db, "tables", state.tableId, "messages")), {
    uid: "NPC", username: "Mestre da Mesa", text: botText, type: "bot", authorRole: "bot", createdAtMs: Date.now(), createdAt: serverTimestamp(), ...extra
  });
  await updateDoc(doc(db, "tables", state.tableId), {
    lastMessage: text.slice(0, 120),
    lastMessageAt: serverTimestamp()
  }).catch(() => {});
  await bumpUnread();
  void notifyTablePush({
    text: botText,
    senderUid: "NPC",
    senderName: ".NPC",
    recipientUids: Array.isArray(extra.privateTo) && extra.privateTo.length ? extra.privateTo : null,
    type: extra.systemEvent || "bot"
  });
}

async function finishTurn() {
  if (!isTurnMode()) return;
  if (state.mutedByTable) return toast("Você está silenciado nesta mesa.", "error");
  const current = currentTurnUid();
  if (!state.isMaster && current !== state.user.uid) return toast("Ainda não é o seu turno.", "error");
  const eligible = turnEligibleMembers();
  if (!eligible.length) return toast("Não há membros disponíveis para turnos.", "error");
  const currentIndex = Math.max(0, eligible.findIndex(member => member.uid === current));
  const next = eligible[(currentIndex + 1) % eligible.length];
  const label = state.isMaster ? `Pular o turno de ${memberName(current)}?` : "Encerrar seu turno e avisar a mesa?";
  openModal(state.isMaster ? "Pular turno" : "Finalizar turno", `<div class="rp-confirm-modal"><p>${esc(label)}</p><button class="rp-primary" id="rp-confirm-turn" type="button">${state.isMaster ? "Pular turno" : "Finalizar turno"}</button></div>`);
  document.querySelector("#rp-confirm-turn")?.addEventListener("click", async () => {
    closeModal();
    try {
      await updateDoc(doc(db, "tables", state.tableId), {
        currentTurnUid: next.uid,
        lastTurnBy: current,
        lastTurnAt: serverTimestamp()
      });
      state.activeParserCodes = [];
      const ownTurn = current === state.user.uid;
      const turnText = ownTurn
        ? `${memberName(state.user.uid)} passou o turno.\nAgora é o turno de ${memberName(next.uid)}.`
        : state.isMaster
          ? `${memberName(state.user.uid)} passou o turno de ${memberName(current)}.\nAgora é o turno de ${memberName(next.uid)}.`
          : `${memberName(state.user.uid)} finalizou o turno.\nAgora é o turno de ${memberName(next.uid)}.`;
      await postNPC(turnText, { systemEvent: "turn-finished", actorUid: state.user.uid, targetUid: current, nextTurnUid: next.uid });
    } catch (error) { console.error(error); toast("Não foi possível avançar o turno.", "error"); }
  });
}

// ============================================================
// DETALHES DA MESA
// ============================================================

function openTableDetails(root) {
  closeModal();
  const backdrop = document.createElement("div");
  backdrop.className = "rp-table-details-backdrop";
  const membersHTML = state.members.map(member => {
    const master = member.uid === state.table.ownerId;
    const mine = member.uid === state.user.uid;
    const muted = Array.isArray(state.table.mutedMembers) && state.table.mutedMembers.includes(member.uid);
    const character = member.characterName || member.character || "Sem personagem";
    const photo = member.avatarDataUrl || member.photoURL || "";
    return `<button class="rp-member-row" data-member="${esc(member.uid)}" type="button">
      <span class="rp-member-avatar">${photo ? `<img src="${esc(photo)}" alt="">` : esc(initials(member.username))}</span>
      <span class="rp-member-main"><strong>${esc(member.username || "Usuário")}</strong><small>${esc(character)}${muted ? " · silenciado" : ""}</small></span>
      ${master ? `<span class="rp-crown">${svgIcon("crown")}</span>` : ""}${!mine ? `<span class="rp-member-chevron">›</span>` : ""}
    </button>`;
  }).join("");
  backdrop.innerHTML = `<div class="rp-table-details" role="dialog" aria-modal="true">
    <div class="rp-details-top">
      <button id="rp-details-back" type="button" aria-label="Voltar">${svgIcon("back")}</button>
      <strong>Detalhes da mesa</strong>
      ${state.isMaster ? `<button id="rp-details-settings" type="button" aria-label="Configurações">${svgIcon("settings")}</button>` : `<span></span>`}
    </div>
    <div class="rp-details-scroll">
      <div class="rp-details-avatar">${svgIcon("table")}</div>
      <h1>${esc(state.table.name || "Mesa sem nome")}</h1>
      <p class="rp-details-members-count">Mesa de RPG • ${state.members.length} ${state.members.length === 1 ? "membro" : "membros"}</p>
      <div class="rp-details-description">${esc(state.table.description || "Esta mesa ainda não possui uma descrição.")}</div>
      ${state.isMaster ? `<button class="rp-primary rp-add-member-wide" id="rp-add-member" type="button">${svgIcon("users")} Adicionar membro</button>` : ""}
      <section class="rp-details-section"><div class="rp-section-head"><h3>Membros</h3></div><div class="rp-members-list">${membersHTML || `<div class="rp-empty">Nenhum membro.</div>`}</div></section>
      <button class="rp-leave-table" id="rp-leave-table" type="button">${svgIcon("exit")} <span>${state.isMaster ? "Abandonar mesa" : "Abandonar mesa"}</span></button>
    </div>
  </div>`;
  document.body.appendChild(backdrop);
  requestAnimationFrame(() => backdrop.classList.add("show"));
  backdrop.querySelector("#rp-details-back")?.addEventListener("click", () => closeTableDetails());
  backdrop.querySelector("#rp-details-settings")?.addEventListener("click", () => openTableDetailsSettings(backdrop));
  backdrop.querySelector("#rp-add-member")?.addEventListener("click", () => openAddMember());
  backdrop.querySelector("#rp-leave-table")?.addEventListener("click", () => confirmTableAction("Abandonar mesa", "Você deixará de participar desta mesa.", async () => { await updateDoc(doc(db, "tables", state.tableId), { members: arrayRemove(state.user.uid), [`unreadCounts.${state.user.uid}`]: 0 }); closeTableDetails(); navigate("/home"); }));
  backdrop.querySelectorAll(".rp-member-row").forEach(row => row.addEventListener("click", () => { if (row.dataset.member !== state.user.uid && state.isMaster) openMemberActions(row.dataset.member); }));
}

function closeTableDetails() {
  const el = document.querySelector(".rp-table-details-backdrop");
  if (!el) return;
  el.classList.remove("show");
  setTimeout(() => el.remove(), 220);
}

function openTableDetailsSettings(backdrop) {
  const existing = backdrop.querySelector(".rp-details-settings-menu");
  if (existing) {
    existing.classList.remove("show");
    setTimeout(() => existing.remove(), 120);
    return;
  }
  const menu = document.createElement("div");
  menu.className = "rp-details-settings-menu";
  const free = isFreeMode();
  menu.innerHTML = `<button type="button" id="rp-detail-toggle-mode">${svgIcon("turn")}<span>${free ? "Modo Turnos" : "Modo Livre"}</span></button><button type="button" id="rp-detail-edit-rules">${svgIcon("settings")}<span>Editar Regras</span></button><button type="button" class="danger" id="rp-detail-delete">${svgIcon("trash")}<span>Deletar Mesa</span></button>`;
  backdrop.querySelector(".rp-table-details")?.appendChild(menu);
  requestAnimationFrame(() => menu.classList.add("show"));
  menu.querySelector("#rp-detail-toggle-mode")?.addEventListener("click", async () => {
    const mode = free ? "turns" : "free";
    try {
      const eligible = turnEligibleMembers();
      await updateDoc(doc(db, "tables", state.tableId), { "settings.mode": mode, mode, currentTurnUid: mode === "turns" ? (eligible[0]?.uid || null) : null });
      await postNPC(`${memberName(state.user.uid)} alterou o modo da mesa.`, { systemEvent: "table-settings-changed", actorUid: state.user.uid, mode });
      menu.remove();
    } catch (e) { toast("Não foi possível alterar o modo.", "error"); }
  });
  menu.querySelector("#rp-detail-edit-rules")?.addEventListener("click", () => {
    menu.remove();
    closeTableDetails();
    navigate(`/edit-table/${encodeURIComponent(state.tableId)}`);
  });
  menu.querySelector("#rp-detail-delete")?.addEventListener("click", () => { menu.remove(); confirmTableAction("Deletar mesa", "A mesa e os dados de jogo serão removidos. Esta ação não pode ser desfeita.", deleteTable); });
}

function openAddMember() {
  const friendIds = Array.isArray(state.user?.friends) ? state.user.friends : [];
  const current = new Set(state.table.members || []);
  const friends = state.members.length ? [] : [];
  const candidates = [];

  // Carregamento assíncrono dos amigos diretamente do perfil.
  getDoc(doc(db, "users", state.user.uid)).then(async snap => {
    const ids = Array.isArray(snap.data()?.friends) ? snap.data().friends : friendIds;
    for (const uid of ids) {
      if (current.has(uid)) continue;
      const fs = await getDoc(doc(db, "users", uid));
      if (!fs.exists()) continue;
      const friendData = fs.data() || {};
      let avatarDataUrl = "";
      try {
        const avatarSnap = await getDoc(doc(db, "users", uid, "profile", "avatar"));
        avatarDataUrl = avatarSnap.exists() ? (avatarSnap.data()?.dataUrl || "") : "";
      } catch (avatarError) {
        console.warn("Falha ao carregar avatar do amigo", uid, avatarError);
      }
      candidates.push({ uid, ...friendData, avatarDataUrl });
    }
    const modal = document.querySelector(".rp-modal-backdrop");
    if (!modal) return;
    const list = modal.querySelector("#rp-friends-to-add");
    list.innerHTML = candidates.length ? candidates.map(f => `<button class="rp-member-row" data-friend="${esc(f.uid)}" type="button"><span class="rp-member-avatar">${f.avatarDataUrl ? `<img src="${esc(f.avatarDataUrl)}" alt="">` : esc(initials(f.username))}</span><span class="rp-member-main"><strong>${esc(f.username || "Usuário")}</strong><small>Adicionar à mesa</small></span><span>＋</span></button>`).join("") : `<div class="rp-empty">Todos os seus amigos já estão nesta mesa.</div>`;
    list.querySelectorAll("[data-friend]").forEach(btn => btn.addEventListener("click", () => addMember(btn.dataset.friend)));
  }).catch(error => console.error(error));

  openModal("Adicionar membros", `<div id="rp-friends-to-add"><div class="rp-loading-inline">Carregando amigos...</div></div>`);
}

async function addMember(uid) {
  if (!state.isMaster || !uid) return;
  try {
    await updateDoc(doc(db, "tables", state.tableId), { members: arrayUnion(uid) });
    await postNPC(`${memberName(state.user.uid)} adicionou ${memberName(uid)} à mesa.`, { systemEvent: "member-added", actorUid: state.user.uid, targetUid: uid });
    closeModal();
    toast("Membro adicionado à mesa.", "success");
    await loadTable();
    await loadMembers();
  } catch (error) {
    console.error(error);
    toast("Não foi possível adicionar esse membro.", "error");
  }
}

function openMemberActions(uid) {
  const member = state.members.find(m => m.uid === uid);
  if (!member) return;
  const muted = Array.isArray(state.table.mutedMembers) && state.table.mutedMembers.includes(uid);
  const modal = openModal(member.username || "Membro", `
    <div class="rp-member-actions">
      <button id="rp-toggle-mute" type="button">${svgIcon("mute")}<span>${muted ? "Remover silêncio" : "Silenciar membro"}</span></button>
      <button class="danger" id="rp-kick" type="button">${svgIcon("kick")}<span>Expulsar da mesa</span></button>
    </div>`);
  modal.querySelector("#rp-toggle-mute")?.addEventListener("click", async () => {
    try {
      await updateDoc(doc(db, "tables", state.tableId), { mutedMembers: muted ? arrayRemove(uid) : arrayUnion(uid) });
      await postNPC(`${memberName(state.user.uid)} ${muted ? "removeu o silêncio de" : "silenciou"} ${memberName(uid)}.`, { systemEvent: muted ? "member-unmuted" : "member-muted", actorUid: state.user.uid, targetUid: uid });
      closeModal();
      toast(muted ? "Membro desmutado." : "Membro silenciado.", "success");
    } catch (error) { console.error(error); toast("Não foi possível alterar o silêncio.", "error"); }
  });
  modal.querySelector("#rp-kick")?.addEventListener("click", async () => {
    try {
      await updateDoc(doc(db, "tables", state.tableId), { members: arrayRemove(uid), mutedMembers: arrayRemove(uid) });
      await postNPC(`${memberName(state.user.uid)} expulsou ${memberName(uid)} da mesa.`, { systemEvent: "member-kicked", actorUid: state.user.uid, targetUid: uid });
      closeModal();
      toast("Membro removido da mesa.", "success");
    } catch (error) { console.error(error); toast("Não foi possível expulsar o membro.", "error"); }
  });
}

function openTableSettings() {
  const currentMode = state.table.settings?.mode || state.table.mode || "free";
  const modal = openModal("Configurações", `
    <div class="rp-wa-settings">
      <div class="rp-wa-profile"><div class="rp-details-map">${svgIcon("table")}</div><div><strong>${esc(state.table.name || "Mesa")}</strong><small>${state.isMaster ? "Você é o mestre" : "Membro da mesa"}</small></div></div>
      <section class="rp-wa-group"><h4>Jogo</h4>
        <label class="rp-setting-choice"><input type="radio" name="rp-mode" value="free" ${currentMode === "free" ? "checked" : ""}><span><strong>Modo livre</strong><small>Todos podem agir quando quiserem.</small></span></label>
        <label class="rp-setting-choice"><input type="radio" name="rp-mode" value="turns" ${currentMode === "turns" ? "checked" : ""}><span><strong>Modo por turnos</strong><small>Ações seguem a ordem da mesa.</small></span></label>
        ${state.isMaster ? `<button class="rp-setting-row" id="rp-edit-rules" type="button">${svgIcon("settings")}<span><strong>Regras da ficha</strong><small>Editar atributos, recursos, equipamentos e habilidades</small></span><b>›</b></button>` : ""}
      </section>
      <section class="rp-wa-group rp-wa-danger">
        ${state.isMaster ? `<button class="rp-wa-danger-btn" id="rp-delete-table" type="button">${svgIcon("trash")}<span>Excluir mesa</span></button>` : `<button class="rp-wa-danger-btn" id="rp-leave-table" type="button">${svgIcon("exit")}<span>Sair da mesa</span></button>`}
      </section>
      ${state.isMaster ? `<button class="rp-primary" id="rp-save-settings" type="button">Salvar configurações</button>` : ""}
    </div>`, () => openTableDetails());
  modal.querySelector("#rp-save-settings")?.addEventListener("click", async () => {
    const mode = modal.querySelector('input[name="rp-mode"]:checked')?.value || "free";
    try {
      const eligible = turnEligibleMembers();
      const turnUpdate = mode === "turns" ? { "settings.mode": mode, mode, ...(state.table.currentTurnUid && eligible.some(member => member.uid === state.table.currentTurnUid) ? {} : { currentTurnUid: eligible[0]?.uid || null }) } : { "settings.mode": mode, mode, currentTurnUid: null };
      await updateDoc(doc(db, "tables", state.tableId), turnUpdate);
      await postNPC(`${memberName(state.user.uid)} atualizou as regras da mesa.`, { systemEvent: "table-settings-changed", actorUid: state.user.uid, mode });
      closeModal(); toast("Configurações salvas.", "success");
    } catch (error) { console.error(error); toast("Não foi possível salvar as configurações.", "error"); }
  });
  modal.querySelector("#rp-edit-rules")?.addEventListener("click", () => {
    closeModal();
    closeTableDetails();
    navigate(`/edit-table/${encodeURIComponent(state.tableId)}`);
  });
  modal.querySelector("#rp-leave-table")?.addEventListener("click", () => confirmTableAction("Sair da mesa", "Você deixará de participar desta mesa.", async () => { await updateDoc(doc(db, "tables", state.tableId), { members: arrayRemove(state.user.uid), [`unreadCounts.${state.user.uid}`]: 0 }); closeModal(); navigate("/home"); }));
  modal.querySelector("#rp-delete-table")?.addEventListener("click", () => confirmTableAction("Excluir mesa", "A mesa e seus dados de jogo serão removidos. Esta ação não pode ser desfeita.", deleteTable));
}

function confirmTableAction(title, text, action) {
  const modal = openModal(title, `<div class="rp-confirm-modal"><p>${esc(text)}</p><button class="rp-primary" id="rp-confirm-table-action" type="button">Confirmar</button></div>`, () => openTableSettings());
  modal.querySelector("#rp-confirm-table-action")?.addEventListener("click", async () => { try { await action(); closeModal(); } catch (error) { console.error(error); toast("Não foi possível concluir a ação.", "error"); } });
}

async function deleteTable() {
  if (!state.isMaster) return;
  const tableRef = doc(db, "tables", state.tableId);
  const [messages, characters] = await Promise.all([
    getDocs(collection(db, "tables", state.tableId, "messages")),
    getDocs(collection(db, "tables", state.tableId, "characters"))
  ]);
  const docs = [...messages.docs, ...characters.docs];
  for (let i = 0; i < docs.length; i += 450) {
    const batch = writeBatch(db);
    docs.slice(i, i + 450).forEach(snap => batch.delete(snap.ref));
    await batch.commit();
  }
  await deleteDoc(tableRef);
  navigate("/home");
}

// ============================================================
// MODAIS
// ============================================================

function openModal(title, content, backAction = null) {
  state.modalBack = backAction;
  const backdrop = document.createElement("div");
  backdrop.className = "rp-modal-backdrop";
  const backButton = backAction ? `<button id="rp-modal-back" type="button" aria-label="Voltar">${svgIcon("back")}</button>` : "";
  backdrop.innerHTML = `<div class="rp-modal" role="dialog" aria-modal="true"><div class="rp-modal-head">${backButton}<strong>${esc(title)}</strong><button id="rp-modal-close" type="button" aria-label="Fechar">${svgIcon("close")}</button></div><div class="rp-modal-body">${content}</div></div>`;
  document.body.appendChild(backdrop);
  requestAnimationFrame(() => backdrop.classList.add("show"));
  backdrop.querySelector("#rp-modal-close")?.addEventListener("click", closeModal);
  backdrop.querySelector("#rp-modal-back")?.addEventListener("click", () => { closeModal(); if (typeof backAction === "function") backAction(); });
  backdrop.addEventListener("click", e => { if (e.target === backdrop) closeModal(); });
  return backdrop;
}

function closeModal() {
  const modals = document.querySelectorAll(".rp-modal-backdrop");
  const modal = modals[modals.length - 1];
  if (!modal) return;
  modal.classList.remove("show");
  setTimeout(() => modal.remove(), 180);
}

function openPhotoViewer(dataUrl) {
  if (!dataUrl) return;
  const modal = openModal("Imagem", `<div class="rp-photo-viewer"><img src="${esc(dataUrl)}" alt="Imagem enviada"></div>`);
  modal.querySelector(".rp-modal")?.classList.add("photo-modal");
}

// ============================================================
// ESTILOS
// ============================================================

let stylesInjected = false;
function injectStyles() {
  if (stylesInjected) return;
  stylesInjected = true;
  const style = document.createElement("style");
  style.textContent = `
    .roleplay-view,.rp-screen{width:100%;height:100dvh;overflow:hidden;background:var(--bg-primary);color:var(--text-primary)}
    .rp-screen{display:flex;flex-direction:column;position:relative;background-image:radial-gradient(circle at 15% 15%,rgba(255,255,255,.025),transparent 25%),radial-gradient(circle at 85% 80%,rgba(255,255,255,.018),transparent 28%)}
    .rp-header{height:64px;flex:0 0 64px;display:flex;align-items:center;gap:6px;padding:0 10px;border-bottom:1px solid var(--border-color);background:linear-gradient(180deg,var(--bg-secondary),var(--bg-primary));z-index:10;box-shadow:0 2px 12px rgba(0,0,0,.12)}
    .rp-back,.rp-header-more{width:44px;height:44px;border:0;border-radius:50%;background:transparent;color:var(--text-primary);display:grid;place-items:center;cursor:pointer}.rp-back:hover,.rp-header-more:hover{background:rgba(255,255,255,.055)}
    .rp-back svg,.rp-header-more svg{width:22px;height:22px}
    .rp-title-button{flex:1;min-width:0;border:0;background:transparent;color:var(--text-primary);text-align:left;padding:5px 8px;display:flex;flex-direction:column;cursor:pointer}.rp-title-button strong{font-size:1rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.rp-title-button span{font-size:.72rem;color:var(--text-secondary);margin-top:2px}
    .rp-chat{flex:1;min-height:0;overflow-y:auto;overflow-x:hidden;overscroll-behavior:contain;padding:0 10px 18px;min-width:0;max-width:100%;touch-action:pan-y}.rp-chat-inner{min-width:0;max-width:900px;width:100%;overflow-x:clip}.rp-turn-queue{width:calc(100% + 20px);max-width:none;box-sizing:border-box;overflow:hidden;min-width:0;flex:0 0 auto}.rp-turn-member{max-width:46px}.rp-turn-queue{flex-wrap:wrap;align-content:center}.rp-turn-queue[hidden]{display:none!important}.rp-turn-queue{position:sticky;top:0;z-index:8;min-height:58px;display:flex;align-items:center;justify-content:center;gap:7px;padding:8px 6px;margin:0 -10px 10px;background:color-mix(in srgb,var(--bg-primary) 96%,transparent);backdrop-filter:blur(12px);border-bottom:1px solid var(--border-color);box-shadow:0 3px 12px rgba(0,0,0,.12)}.rp-turn-member{width:36px;height:36px;flex:0 0 36px;border-radius:50%;display:grid;place-items:center;opacity:.58;transform:scale(.9);transition:.18s ease}.rp-turn-member.active{width:46px;height:46px;flex-basis:46px;opacity:1;transform:scale(1);border:2px solid var(--accent-secondary);box-shadow:0 0 0 3px color-mix(in srgb,var(--accent-secondary) 18%,transparent)}.rp-turn-avatar{width:100%;height:100%;border-radius:50%;overflow:hidden;display:grid;place-items:center;background:var(--bg-secondary);border:1px solid var(--border-color);font-size:.58rem;font-weight:800}.rp-turn-avatar img{width:100%;height:100%;object-fit:cover}.rp-turn-arrow{color:var(--text-secondary);font-size:1.15rem;line-height:1}.rp-turn-empty{font-size:.72rem;color:var(--text-secondary)}.rp-chat-inner{max-width:900px;margin:0 auto;display:flex;flex-direction:column;gap:4px}.rp-day{text-align:center;margin:7px 0 10px}.rp-day span{display:inline-block;padding:5px 11px;border-radius:12px;background:var(--bg-secondary);color:var(--text-secondary);font-size:.7rem;box-shadow:0 1px 2px rgba(0,0,0,.12)}
    .rp-bubble-wrap{display:flex;align-items:flex-end;gap:6px;margin:2px 0;max-width:88%}.rp-bubble-wrap.mine{align-self:flex-end;flex-direction:row-reverse}.rp-bubble-wrap.bot{align-self:center;max-width:90%;justify-content:center}.rp-bubble{position:relative;padding:8px 10px 5px;border-radius:13px;background:#3b3940;box-shadow:0 1px 2px rgba(0,0,0,.18);min-width:48px}.rp-bubble-wrap.mine .rp-bubble{border-bottom-right-radius:4px}.rp-bubble-wrap:not(.mine):not(.bot) .rp-bubble{border-bottom-left-radius:4px}.rp-bubble-wrap.role-master .rp-bubble{background:#8f3030}.rp-bubble-wrap.role-player .rp-bubble{background:#48404f}.rp-bubble-wrap.role-bot .rp-bubble{background:#315b43}.rp-sender{font-size:.7rem;font-weight:750;opacity:.82;margin-bottom:3px}.rp-bubble-wrap.mine .rp-sender{display:none}.rp-message-text{font-size:.93rem;line-height:1.42;white-space:normal;overflow-wrap:anywhere}.rp-meta{text-align:right;font-size:.61rem;opacity:.58;margin:4px 0 0 12px}.rp-avatar{width:31px;height:31px;flex:0 0 31px;border-radius:50%;overflow:hidden;display:grid;place-items:center;background:var(--bg-secondary);font-size:.63rem;font-weight:800;color:var(--text-primary);border:1px solid var(--border-color)}.rp-avatar img,.rp-member-avatar img{width:100%;height:100%;object-fit:cover}.rp-bot-avatar{background:#315b43;color:#c9ead4}.rp-caption{font-size:.8rem;margin-top:5px}.rp-photo-message{padding:0;border:0;background:transparent;display:block;width:40vw;height:40vw;max-width:40vw;max-height:40vw;cursor:pointer;overflow:hidden;border-radius:9px}.rp-photo-message img{display:block;width:100%;height:100%;max-width:100%;max-height:100%;aspect-ratio:1 / 1;object-fit:cover;border-radius:9px}.rp-bubble-wrap.mine .rp-photo-message{width:40vw;height:40vw;max-width:40vw;max-height:40vw}
    .rp-parser-menu{position:absolute;left:52px;right:52px;bottom:60px;max-width:560px;margin:auto;padding:6px;border:1px solid var(--border-color);border-radius:16px;background:var(--bg-secondary);box-shadow:0 12px 35px rgba(0,0,0,.32);z-index:25;overflow:hidden}.rp-parser-menu[hidden]{display:none}.rp-parser-option{width:100%;display:flex;align-items:center;gap:9px;padding:9px 11px;border:0;border-radius:11px;background:transparent;color:var(--text-primary);text-align:left;font:inherit;cursor:pointer}.rp-parser-option:hover{background:var(--bg-card)}.rp-parser-option span{font-weight:800;min-width:46px}.rp-parser-option small{color:var(--text-secondary)}.rp-parser-option-parser span{color:var(--accent-secondary)}.rp-parser-option-mention span{color:#8bb8ff}.rp-parser-context{display:flex;flex-wrap:wrap;align-items:center;justify-content:center;gap:6px;padding:8px 10px;margin-bottom:10px;border:1px solid var(--border-color);border-radius:12px;background:var(--bg-secondary);font-size:.72rem;color:var(--text-secondary)}.rp-parser-context b{padding:4px 7px;border-radius:999px;background:rgba(180,150,100,.16);color:var(--accent-secondary);font-size:.7rem}.rp-parser-markers{display:flex;align-items:center;gap:5px;margin-top:5px;font-size:.62rem;color:var(--text-secondary);opacity:.85}.rp-parser-markers b{padding:2px 6px;border-radius:999px;background:rgba(180,150,100,.13);color:var(--accent-secondary)}
    .rp-composer-wrap{position:relative;padding:7px 8px calc(8px + env(safe-area-inset-bottom));background:linear-gradient(180deg,var(--bg-primary),var(--bg-secondary));border-top:1px solid var(--border-color);z-index:20}.rp-composer{max-width:900px;margin:auto;display:flex;align-items:flex-end;gap:5px}.rp-composer textarea{flex:1;min-width:0;max-height:130px;min-height:44px;padding:11px 13px;border:1px solid var(--border-color);border-radius:23px;background:var(--bg-secondary);color:var(--text-primary);font:inherit;line-height:1.35;resize:none;outline:none}.rp-composer textarea:focus{border-color:color-mix(in srgb,var(--accent-purple) 55%,var(--border-color));box-shadow:0 0 0 3px rgba(107,33,168,.1)}.rp-composer textarea::placeholder{color:var(--text-secondary);opacity:.75}.rp-attach,.rp-send{width:44px;height:44px;flex:0 0 44px;border:0;border-radius:50%;display:grid;place-items:center;cursor:pointer}.rp-attach{background:transparent;color:var(--text-secondary)}.rp-attach:hover{background:rgba(255,255,255,.05);color:var(--text-primary)}.rp-attach svg{width:22px;height:22px}.rp-send{background:var(--accent-secondary);color:var(--bg-primary);box-shadow:0 4px 13px rgba(0,0,0,.2);touch-action:none}.rp-send svg{width:22px;height:22px}.rp-send.loading{opacity:.6;transform:scale(.94)}.rp-send:disabled,.rp-attach:disabled{opacity:.35;cursor:not-allowed}.rp-composer textarea:disabled{opacity:.62;cursor:not-allowed}
    .rp-quick-dial{touch-action:none;position:absolute;right:8px;bottom:66px;display:flex;flex-direction:column-reverse;gap:9px;align-items:center;transform:translateY(18px) scale(.92);transform-origin:bottom right;opacity:0;pointer-events:none;transition:transform .22s ease,opacity .22s ease}.rp-quick-dial.open{transform:none;opacity:1;pointer-events:auto}.rp-quick-item{width:54px;min-height:58px;border:1px solid var(--border-color);border-radius:18px;background:var(--bg-secondary);color:var(--text-primary);box-shadow:0 8px 24px rgba(0,0,0,.28);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:3px;font-size:.59rem;cursor:pointer}.rp-quick-item:hover{background:var(--bg-card)}.rp-quick-icon{width:24px;height:24px;display:grid;place-items:center}.rp-quick-icon svg{width:22px;height:22px}.rp-dice-button-icon svg{width:27px;height:27px}
    .rp-loading,.rp-error-screen{width:100%;height:100%;display:grid;place-items:center;align-content:center;gap:12px}.rp-spinner{width:27px;height:27px;border:2px solid var(--border-color);border-top-color:var(--accent-secondary);border-radius:50%;animation:rp-spin .8s linear infinite}@keyframes rp-spin{to{transform:rotate(360deg)}}.rp-error-screen{padding:24px;box-sizing:border-box}.rp-error-back{position:absolute;top:16px;left:12px;background:none;border:0;color:var(--text-primary);display:flex;align-items:center;gap:4px}.rp-error-back svg{width:20px}.rp-error-card{text-align:center;max-width:360px}.rp-error-icon{width:48px;height:48px;margin:0 auto 12px;border-radius:50%;display:grid;place-items:center;background:#8f3030;font-weight:800}.rp-error-card p{color:var(--text-secondary);line-height:1.5}
    .rp-lock-overlay{position:absolute;inset:64px 0 0;z-index:40;background:color-mix(in srgb,var(--bg-primary) 88%,transparent);backdrop-filter:blur(12px);display:grid;place-items:center;padding:24px}.rp-lock-card{max-width:390px;text-align:center;padding:26px;border:1px solid var(--border-color);border-radius:22px;background:var(--bg-secondary);box-shadow:0 20px 60px rgba(0,0,0,.3)}.rp-lock-mark{font-size:2rem;color:var(--accent-secondary);margin-bottom:8px}.rp-lock-card p{color:var(--text-secondary);line-height:1.5}.rp-primary,.rp-ghost{min-height:44px;border-radius:13px;padding:0 16px;font:inherit;font-weight:700;cursor:pointer}.rp-primary{border:0;background:var(--accent-secondary);color:var(--bg-primary)}.rp-ghost{border:1px solid var(--border-color);background:transparent;color:var(--text-primary);margin-top:8px}
    .rp-modal-backdrop{position:fixed;inset:0;z-index:400;background:rgba(0,0,0,.58);display:flex;align-items:flex-end;justify-content:center;opacity:0;transition:opacity .18s ease}.rp-modal-backdrop.show{opacity:1}.rp-modal{width:min(720px,100%);max-height:min(88dvh,760px);background:var(--bg-primary);border:1px solid var(--border-color);border-bottom:0;border-radius:24px 24px 0 0;overflow:hidden;transform:translateY(20px);transition:transform .2s ease;box-shadow:0 -15px 60px rgba(0,0,0,.3)}.rp-modal-backdrop.show .rp-modal{transform:none}.rp-modal-head{height:58px;display:flex;align-items:center;padding:0 14px 0 18px;border-bottom:1px solid var(--border-color)}.rp-modal-head strong{flex:1}.rp-modal-head>button:first-child{margin-right:2px}.rp-modal-head button{width:38px;height:38px;border:0;border-radius:50%;background:transparent;color:var(--text-primary);display:grid;place-items:center}.rp-modal-head button svg{width:20px}.rp-modal-body{padding:15px;max-height:calc(min(88dvh,760px) - 58px);overflow:auto}.rp-details-cover{display:flex;gap:13px;align-items:center;padding:6px 4px 16px}.rp-details-map{width:54px;height:54px;border-radius:16px;background:var(--bg-secondary);display:grid;place-items:center;color:var(--accent-secondary);font-size:1.5rem}.rp-details-cover div:last-child{display:flex;flex-direction:column}.rp-details-cover span,.rp-member-main small,.rp-setting-row small,.rp-setting-choice small{color:var(--text-secondary);font-size:.74rem;margin-top:3px}.rp-details-section{border-top:1px solid var(--border-color);padding:14px 0}.rp-section-head{display:flex;align-items:center;justify-content:space-between;margin-bottom:7px}.rp-section-head h3{margin:0;font-size:.88rem}.rp-icon-button{width:38px;height:38px;border:0;border-radius:50%;background:var(--bg-secondary);color:var(--text-primary);display:grid;place-items:center}.rp-icon-button svg{width:20px}.rp-member-row,.rp-setting-row{width:100%;display:flex;align-items:center;gap:11px;padding:10px 4px;border:0;border-radius:13px;background:transparent;color:var(--text-primary);text-align:left;cursor:pointer}.rp-member-row:hover,.rp-setting-row:hover{background:var(--bg-secondary)}.rp-member-avatar{width:43px;height:43px;flex:0 0 43px;border-radius:50%;overflow:hidden;display:grid;place-items:center;background:var(--bg-secondary);font-size:.7rem;font-weight:800}.rp-member-main{flex:1;display:flex;flex-direction:column}.rp-crown{color:var(--accent-secondary);width:22px}.rp-crown svg{width:20px;height:20px}.rp-member-chevron,.rp-setting-row>b{color:var(--text-secondary);font-size:1.35rem}.rp-setting-row>svg{width:22px;height:22px;flex:0 0 22px}.rp-setting-row span{flex:1;display:flex;flex-direction:column}.rp-empty{padding:18px;text-align:center;color:var(--text-secondary);font-size:.82rem}.rp-member-actions{display:flex;flex-direction:column;gap:5px}.rp-member-actions button{min-height:52px;border:0;border-radius:13px;background:var(--bg-secondary);color:var(--text-primary);display:flex;align-items:center;gap:12px;padding:0 14px;font:inherit;text-align:left}.rp-member-actions button svg{width:21px;height:21px}.rp-member-actions .danger{color:#e88a8a}.rp-settings-form{display:flex;flex-direction:column;gap:8px}.rp-setting-choice{display:flex;gap:12px;padding:13px;border:1px solid var(--border-color);border-radius:15px;cursor:pointer}.rp-setting-choice input{accent-color:var(--accent-secondary);margin-top:4px}.rp-setting-choice span{display:flex;flex-direction:column}.rp-dice-modal{text-align:center}.rp-dice-roll-grid{grid-template-columns:repeat(4,1fr);margin-bottom:12px}.rp-die-option{min-height:96px;border:1px solid var(--border-color);border-radius:15px;background:var(--bg-secondary);color:var(--text-primary);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4px;cursor:pointer}.rp-die-option:hover{border-color:var(--accent-secondary);transform:translateY(-1px)}.rp-die-visual{height:58px;display:grid;place-items:center}.rp-die-visual>svg{width:54px;height:54px}.rp-d100-double{display:flex;gap:2px;align-items:center}.rp-d100-double svg{width:30px;height:30px}.rp-roll-declaration-box{margin:12px 0;padding:10px;border:1px solid var(--border-color);border-radius:15px;background:var(--bg-secondary);text-align:left}.rp-roll-declaration-title{font-size:.72rem;color:var(--text-secondary);margin-bottom:7px}.rp-roll-empty{font-size:.75rem;color:var(--text-secondary)}.rp-roll-pill{border:0;border-radius:999px;padding:7px 10px;margin:3px;font:inherit;font-size:.72rem;color:#fff;cursor:pointer}.rp-pill-dice{background:#7c5a9b}.rp-pill-attribute{background:#7a1f2b}.rp-pill-equipment{background:#9b6b3d}.rp-pill-ability{background:#9b4f83}.rp-pill-skill{background:#397d72}.rp-declaration-disabled{filter:brightness(.42) saturate(.55);opacity:.62;cursor:not-allowed!important;pointer-events:none}.rp-declaration-disabled:hover{transform:none;border-color:var(--border-color)}.rp-declaration-restriction{color:#d18b8b!important;font-weight:700}.rp-declaration-bonus{display:block;margin-top:6px;color:var(--accent-secondary);font-size:.7rem}.rp-roll-declaration-actions{display:flex;flex-direction:column;gap:7px;margin:10px 0}.rp-declare{width:100%;display:block;min-height:42px;border:1px solid var(--border-color);border-radius:12px;background:var(--bg-secondary);font:inherit;font-size:.75rem;color:var(--text-primary);cursor:pointer}.rp-declare.equipment{border-color:#9b6b3d}.rp-declare.ability{border-color:#9b4f83}.rp-declare.skill{border-color:#397d72}.rp-roll-submit{width:100%;margin-top:5px}.rp-declaration-picker{display:flex;flex-direction:column;gap:6px}.rp-declaration-option{border:1px solid var(--border-color);border-radius:13px;background:var(--bg-secondary);color:var(--text-primary);padding:11px;text-align:left;display:flex;flex-direction:column;cursor:pointer}.rp-declaration-option small{color:var(--text-secondary);margin-top:3px}.rp-roll-details{margin-top:7px;padding:7px 9px;border-radius:9px;background:rgba(0,0,0,.13);font-size:.69rem;display:flex;flex-direction:column;gap:3px}.rp-roll-details strong{opacity:.75}.rp-roll-details span,.rp-roll-details small{opacity:.8}.rp-dice-large{height:100px;display:grid;place-items:center;color:var(--accent-secondary)}.rp-dice-large svg{width:90px;height:90px}.rp-dice-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:8px}.rp-dice-grid button{min-height:48px;border:1px solid var(--border-color);border-radius:12px;background:var(--bg-secondary);color:var(--text-primary);font-weight:750}.rp-confirm-modal p{text-align:center;color:var(--text-secondary);margin:4px 0 16px}.rp-photo-viewer{display:grid;place-items:center;min-height:40vh}.rp-photo-viewer img{max-width:100%;max-height:65vh;border-radius:12px;object-fit:contain}.photo-modal{max-height:95dvh}.rp-loading-inline{text-align:center;color:var(--text-secondary);padding:20px}.rp-toast{position:fixed;left:50%;bottom:90px;z-index:200;transform:translate(-50%,15px);opacity:0;transition:.2s ease;padding:10px 14px;border-radius:12px;background:var(--bg-secondary);border:1px solid var(--border-color);color:var(--text-primary);box-shadow:0 8px 28px rgba(0,0,0,.25);font-size:.8rem}.rp-toast.show{transform:translate(-50%,0);opacity:1}.rp-toast-success{border-color:color-mix(in srgb,var(--accent-secondary) 45%,var(--border-color))}.rp-toast-error{border-color:#8f3030}
    .rp-typing-wrap{display:flex;align-items:center;gap:7px;margin:4px 0 8px 3px}.rp-typing-avatar{width:28px;height:28px;flex:0 0 28px}.rp-typing-bubble{display:flex;align-items:center;gap:3px;padding:8px 11px;border-radius:14px 14px 14px 4px;background:#48404f;color:#d8d2df;box-shadow:0 1px 2px rgba(0,0,0,.18);font-size:.68rem}.rp-typing-bubble i{width:4px;height:4px;border-radius:50%;background:#b9b0c4;animation:rp-typing 1.1s infinite ease-in-out}.rp-typing-bubble i:nth-child(3){animation-delay:.15s}.rp-typing-bubble i:nth-child(4){animation-delay:.3s}@keyframes rp-typing{0%,60%,100%{transform:translateY(0);opacity:.45}30%{transform:translateY(-3px);opacity:1}}.rp-message-hit{display:contents}.rp-message-actions{display:flex;flex-direction:column;gap:6px}.rp-message-actions button{min-height:52px;border:0;border-radius:13px;background:var(--bg-secondary);color:var(--text-primary);display:flex;align-items:center;gap:12px;padding:0 15px;font:inherit;text-align:left}.rp-message-actions .danger,.rp-wa-danger-btn{color:#e88a8a}.rp-edit-message-input{width:100%;min-height:130px;box-sizing:border-box;padding:12px;border:1px solid var(--border-color);border-radius:13px;background:var(--bg-secondary);color:var(--text-primary);font:inherit;resize:vertical;margin-bottom:10px}.rp-wa-settings{display:flex;flex-direction:column;gap:10px}.rp-wa-profile{display:flex;align-items:center;gap:13px;padding:14px;background:var(--bg-secondary);border-radius:16px}.rp-wa-profile>div:last-child{display:flex;flex-direction:column}.rp-wa-profile small{color:var(--text-secondary);margin-top:3px}.rp-wa-group{display:flex;flex-direction:column;gap:4px;padding:6px 0;border-top:1px solid var(--border-color)}.rp-wa-group h4{margin:6px 4px;color:var(--text-secondary);font-size:.72rem;text-transform:uppercase;letter-spacing:.06em}.rp-wa-danger{margin-top:4px}.rp-wa-danger-btn{min-height:50px;border:0;background:transparent;text-align:left;padding:0 8px;font:inherit;font-weight:750;cursor:pointer;display:flex;align-items:center;gap:11px}.rp-wa-danger-btn svg{width:22px;height:22px;flex:0 0 22px}.rp-details-map svg{width:28px;height:28px}.rp-setting-row>svg{flex:0 0 22px}.rp-wa-settings .rp-primary{margin-top:5px}.rp-setting-choice{background:transparent}.rp-setting-choice:hover{background:var(--bg-secondary)}

    .rp-table-details-backdrop{position:fixed;inset:0;z-index:300;background:var(--bg-primary);transform:translateY(100%);transition:transform .24s cubic-bezier(.22,.8,.25,1);overflow:hidden}.rp-table-details-backdrop.show{transform:none}.rp-table-details{height:100dvh;display:flex;flex-direction:column;background:var(--bg-primary);color:var(--text-primary)}.rp-details-top{height:58px;min-height:58px;display:grid;grid-template-columns:44px 1fr 44px;align-items:center;padding:0 8px;border-bottom:1px solid var(--border-color);background:var(--bg-primary);position:sticky;top:0;z-index:2}.rp-details-top>button{width:42px;height:42px;border:0;background:transparent;color:var(--text-primary);display:grid;place-items:center;border-radius:50%}.rp-details-top svg{width:21px;height:21px}.rp-details-top strong{text-align:center;font-size:.96rem}.rp-details-scroll{overflow:auto;padding:22px 18px 32px;max-width:760px;width:100%;margin:0 auto}.rp-details-avatar{width:92px;height:92px;margin:6px auto 14px;border-radius:50%;display:grid;place-items:center;background:var(--bg-secondary);color:var(--accent-secondary);border:1px solid var(--border-color)}.rp-details-avatar svg{width:48px;height:48px}.rp-details-scroll h1{text-align:center;font-size:1.35rem;margin:0}.rp-details-members-count{text-align:center;color:var(--text-secondary);font-size:.8rem;margin:5px 0 18px}.rp-details-description{padding:15px;border:1px solid var(--border-color);border-radius:16px;background:var(--bg-secondary);font-size:.83rem;line-height:1.5;margin-bottom:12px}.rp-add-member-wide{width:100%;display:flex;justify-content:center;gap:8px;align-items:center}.rp-add-member-wide svg{width:19px}.rp-details-settings-menu{position:absolute;right:10px;top:55px;width:min(250px,calc(100vw - 20px));padding:6px;border:1px solid var(--border-color);border-radius:15px;background:var(--bg-secondary);box-shadow:0 14px 40px rgba(0,0,0,.3);transform:translateY(-6px) scale(.97);opacity:0;transition:.15s ease;z-index:5}.rp-details-settings-menu.show{transform:none;opacity:1}.rp-details-settings-menu button{width:100%;min-height:46px;border:0;border-radius:10px;background:transparent;color:var(--text-primary);display:flex;align-items:center;gap:10px;padding:0 11px;font:inherit;text-align:left}.rp-details-settings-menu button:hover{background:var(--bg-primary)}.rp-details-settings-menu button svg{width:19px}.rp-details-settings-menu .danger{color:#d66b6b}.rp-leave-table{width:100%;min-height:48px;margin-top:18px;border:1px solid rgba(190,70,70,.45);border-radius:14px;background:transparent;color:#d66b6b;display:flex;align-items:center;justify-content:center;gap:8px;font:inherit;font-weight:700}.rp-leave-table svg{width:20px}
    @media(min-width:700px){.rp-screen{max-width:900px;margin:0 auto;border-left:1px solid var(--border-color);border-right:1px solid var(--border-color)}.rp-composer-wrap{padding-left:14px;padding-right:14px}.rp-modal-backdrop{align-items:center}.rp-modal{border-bottom:1px solid var(--border-color);border-radius:22px;transform:translateY(12px)}.rp-modal-body{max-height:calc(88dvh - 58px)}}
    @media(max-width:430px){.rp-bubble-wrap{max-width:91%}.rp-photo-message{max-width:250px}.rp-header{height:60px;flex-basis:60px}.rp-lock-overlay{inset:60px 0 0}.rp-quick-item{width:52px}.rp-composer textarea{font-size:.92rem}.rp-chat{padding-left:7px;padding-right:7px}}
  `;
  document.head.appendChild(style);
  const horizontalGuard = document.createElement("style");
  horizontalGuard.textContent = `.rp-screen,.rp-chat,.rp-chat-inner,#rp-messages{min-width:0!important;max-width:100%!important;overflow-x:hidden!important;overscroll-behavior-x:none!important;touch-action:pan-y!important}.rp-turn-queue{width:calc(100% + 20px)!important;max-width:none!important;box-sizing:border-box!important;flex:0 0 auto!important;flex-wrap:wrap!important;white-space:normal!important;margin-left:-10px!important;margin-right:-10px!important;overflow:hidden!important}.rp-chat *{max-width:100%;box-sizing:border-box}`;
  document.head.appendChild(horizontalGuard);
}

// ============================================================
// LIMPEZA AO SAIR
// ============================================================

export function destroy() {
  state.unsubscribeMessages?.();
  state.unsubscribeTable?.();
  state.unsubscribeMembers?.();
  state.unsubscribeCharacterAccess?.();
  state.unsubscribeMessages = null;
  state.unsubscribeTable = null;
  state.unsubscribeMembers = null;
  state.unsubscribeCharacterAccess = null;
  clearTimeout(state.typingTimer);
  setTyping(false);
}
