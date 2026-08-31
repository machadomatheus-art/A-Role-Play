// A Role Play — FCM Web (Passo 1)
// Apenas prepara o push e obtém o token para teste.
// O token NÃO é salvo no banco nesta etapa.

import { getApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { auth } from "./firebase-config.js";

import {
  getMessaging,
  getToken,
  isSupported
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-messaging.js";

const VAPID_KEY = "BG4j-A75THLaMRhTdsf1UV9mx8erUV2uxIFVXC3r4vlxsLJ_iOoa2ZfFNWzZ7SYdDPhF9rbEF0DiDYFZhLDO4wk";

async function callPushFunction(body) {
  const SUPABASE_URL = "https://bltfkwrdinbbhymkvlja.supabase.co";
  const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_vuloBZrcNLfFo1csM6nSyA_KGyuh5MS";
  const response = await fetch(`${SUPABASE_URL}/functions/v1/send-push`, { method: "POST", headers: { "Content-Type": "application/json", apikey: SUPABASE_PUBLISHABLE_KEY, Authorization: `Bearer ${SUPABASE_PUBLISHABLE_KEY}` }, body: JSON.stringify(body) });
  const data = await response.json();
  if (!response.ok || !data?.ok) throw new Error(data?.error || `Erro na central de notificações (${response.status}).`);
  return data;
}

async function registerPushToken(user, token) {
  return callPushFunction({ action: "register_token", user_id: user.uid, token, platform: "web", user_agent: navigator.userAgent });
}

export async function enableARolePlayPushNotifications() {
  if (!window.isSecureContext) {
    throw new Error("O FCM Web precisa estar em HTTPS (ou localhost durante o desenvolvimento).");
  }

  if (!("serviceWorker" in navigator) || !("Notification" in window)) {
    throw new Error("Este navegador não oferece suporte a notificações push do A Role Play.");
  }

  if (!(await isSupported())) {
    throw new Error("O Firebase Messaging Web não é suportado neste navegador.");
  }

  const user = auth.currentUser;
  if (!user) throw new Error("Nenhum usuário do A Role Play está conectado.");

  // Usa o ÚNICO service worker do PWA.
  const swUrl = new URL("../sw.js", import.meta.url).href;
  const appScope = new URL("../", import.meta.url).href;

  console.log("[A Role Play] Registrando Service Worker:", { swUrl, appScope });

  let registration;
  try {
    registration = await navigator.serviceWorker.register(swUrl, {
      scope: appScope,
      updateViaCache: "none"
    });
  } catch (error) {
    console.error("[A Role Play] Falha ao registrar Service Worker:", error);
    throw new Error(`Não foi possível registrar o Service Worker: ${error?.message || error}`);
  }

  // Aguarda ESTE registro ficar ativo. Não depende do navigator.serviceWorker.ready,
  // que pode apontar para outro registro/escopo em uma SPA hospedada em subpasta.
  if (!registration.active) {
    await new Promise((resolve, reject) => {
      const worker = registration.installing || registration.waiting;
      if (!worker) {
        reject(new Error("O Service Worker foi registrado, mas não iniciou a instalação."));
        return;
      }
      const timeout = setTimeout(() => {
        reject(new Error(`O Service Worker não ficou ativo a tempo (estado: ${worker.state}).`));
      }, 20000);
      worker.addEventListener("statechange", () => {
        if (worker.state === "activated") {
          clearTimeout(timeout);
          resolve();
        } else if (worker.state === "redundant") {
          clearTimeout(timeout);
          reject(new Error("O Service Worker tornou-se inválido durante a instalação."));
        }
      });
    });
  }

  console.log("[A Role Play] Service Worker ativo:", {
    scriptURL: registration.active?.scriptURL,
    scope: registration.scope,
    state: registration.active?.state
  });

  console.log("[A Role Play] Permissão atual das notificações:", Notification.permission);
  const permission = await Notification.requestPermission();
  console.log("[A Role Play] Resultado da permissão:", permission);

  if (permission !== "granted") {
    console.warn("[A Role Play] Permissão para notificações não concedida.");
    return null;
  }

  // firebase-config.js já inicializou o app antes de carregar este módulo.
  const app = getApp();
  const messaging = getMessaging(app);

  console.log("[A Role Play] Solicitando token FCM...");
  const token = await getToken(messaging, {
    vapidKey: VAPID_KEY,
    serviceWorkerRegistration: registration
  });

  if (!token) {
    throw new Error("O Firebase não retornou um token FCM.");
  }

  console.log("[A Role Play] FCM token obtido:", token);
  console.log("[A Role Play] Registrando token no Supabase...");
  const registered = await registerPushToken(user, token);
  console.log("[A Role Play] Token registrado no Supabase:", registered);
  return token;
}

// Disponível no Eruda/console para o primeiro teste.
window.enableARolePlayPushNotifications = enableARolePlayPushNotifications;
console.log("[A Role Play] notifications.js carregado. Execute enableARolePlayPushNotifications() para testar.");


export async function sendARolePlayPush({ tableId, tableName = "A Role Play", senderUid = "", senderName = "Usuário", body = "", recipientUids = [], type = "message" } = {}) {
  if (!tableId || !body || !recipientUids?.length) return null;
  if (typeof Notification !== "undefined" && Notification.permission !== "granted") return null;
  return callPushFunction({ action: "send_table_message", table_id: tableId, table_name: tableName, sender_uid: senderUid, sender_name: senderName, body, recipient_uids: [...new Set(recipientUids.filter(Boolean))], type });
}
