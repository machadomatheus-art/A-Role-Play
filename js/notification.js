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
  const registration = await navigator.serviceWorker.register("/sw.js", {
    scope: "/"
  });

  // Aguarda um SW ativo antes de entregá-lo ao FCM.
  await navigator.serviceWorker.ready;

  const permission = await Notification.requestPermission();

  if (permission !== "granted") {
    console.warn("[A Role Play] Permissão para notificações não concedida.");
    return null;
  }

  // firebase-config.js já inicializou o app antes de carregar este módulo.
  const app = getApp();
  const messaging = getMessaging(app);

  const token = await getToken(messaging, {
    vapidKey: VAPID_KEY,
    serviceWorkerRegistration: registration
  });

  if (!token) {
    throw new Error("O Firebase não retornou um token FCM.");
  }

  console.log("[A Role Play] FCM token:", token);
  await registerPushToken(user, token);
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
