/* A Role Play — Service Worker
 *
 * PWA cache + offline support + Firebase Cloud Messaging.
 *
 * IMPORTANTE:
 * Este projeto está hospedado em:
 * https://machadomatheus-art.github.io/A-Role-Play/
 *
 * Todos os caminhos são relativos ao próprio Service Worker,
 * para não interferir com outros projetos hospedados no mesmo domínio.
 */

importScripts("https://www.gstatic.com/firebasejs/10.8.0/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/10.8.0/firebase-messaging-compat.js");

const firebaseConfig = {
  apiKey: "AIzaSyBUg7l99dLX04OrqM_jlb6-58y1A9BB3N8",
  authDomain: "rpg-ee17e.firebaseapp.com",
  projectId: "rpg-ee17e",
  storageBucket: "rpg-ee17e.firebasestorage.app",
  messagingSenderId: "136442258825",
  appId: "1:136442258825:web:b7dadfb6c2d6d3ed5a2d58"
};

firebase.initializeApp(firebaseConfig);

const messaging = firebase.messaging();

/*
 * Como o SW está em:
 *
 * /A-Role-Play/sw.js
 *
 * self.location.pathname permite descobrir automaticamente:
 *
 * /A-Role-Play/
 *
 * Assim o mesmo arquivo funciona no GitHub Pages
 * sem usar caminhos absolutos do domínio.
 */

const APP_BASE = new URL("./", self.location.href);

const APP_ROOT = APP_BASE.href;

const INDEX_URL = new URL("index.html", APP_BASE).href;

const ICON_URL = new URL(
  "assets/icons/icon-192.png",
  APP_BASE
).href;

const CACHE_VERSION = "a-role-play-v5";

/*
 * CORREÇÃO:
 * Antes estava usando aspas normais:
 *
 * "${CACHE_VERSION}-runtime"
 *
 * Isso transformava literalmente o nome do cache em:
 *
 * ${CACHE_VERSION}-runtime
 *
 * Agora usamos template literal.
 */

const RUNTIME_CACHE = `${CACHE_VERSION}-runtime`;

const APP_SHELL = [
  APP_ROOT,
  INDEX_URL
];

const OFFLINE_URL = INDEX_URL;


/* =========================================================
   INSTALL
========================================================= */

self.addEventListener("install", (event) => {

  console.log(
    "[A Role Play] SW instalando:",
    {
      sw: self.location.href,
      appRoot: APP_ROOT,
      index: INDEX_URL
    }
  );

  event.waitUntil(

    caches
      .open(CACHE_VERSION)

      .then((cache) => {

        return cache.addAll(APP_SHELL);

      })

      .then(() => {

        console.log(
          "[A Role Play] SW instalado com sucesso."
        );

        return self.skipWaiting();

      })

      .catch((error) => {

        console.error(
          "[A Role Play] ❌ Erro durante instalação do SW:",
          error
        );

        throw error;

      })

  );

});


/* =========================================================
   ACTIVATE
========================================================= */

self.addEventListener("activate", (event) => {

  event.waitUntil(

    caches
      .keys()

      .then((keys) => {

        return Promise.all(

          keys

            .filter(
              (key) =>
                key !== CACHE_VERSION &&
                key !== RUNTIME_CACHE
            )

            .map((key) => caches.delete(key))

        );

      })

      .then(() => {

        console.log(
          "[A Role Play] SW ativado:",
          self.location.href
        );

        return self.clients.claim();

      })

  );

});


/* =========================================================
   MENSAGENS DO APP
========================================================= */

self.addEventListener("message", (event) => {

  if (event.data?.type === "SKIP_WAITING") {

    self.skipWaiting();

    return;

  }


  if (event.data?.type === "PING") {

    if (event.ports?.[0]) {

      event.ports[0].postMessage({

        ok: true,

        serviceWorker: true,

        scriptURL: self.location.href,

        scope: APP_ROOT

      });

    }

    return;

  }


  /*
   * Teste manual de notificação.
   *
   * Permite testar o SW sem depender do Firebase.
   */

  if (event.data?.type === "TEST_NOTIFICATION") {

    event.waitUntil(

      self.registration.showNotification(
        "A Role Play",
        {

          body: "🔔 Service Worker funcionando!",

          icon: ICON_URL,

          /*
           * Não usamos badge.
           *
           * Em Android/Firefox, o badge pode acabar
           * aparecendo como um segundo elemento visual.
           *
           * O ícone principal será o ícone do aplicativo.
           */

          tag: "a-role-play-test",

          renotify: true,

          data: {
            link: APP_ROOT
          }

        }
      )

    );

  }

});


/* =========================================================
   FIREBASE CLOUD MESSAGING
========================================================= */

messaging.onBackgroundMessage((payload) => {

  console.log(
    "[A Role Play] 🔔 FCM RECEBIDO PELO SERVICE WORKER:",
    payload
  );


  const notification =
    payload?.notification || {};

  const data =
    payload?.data || {};


  /*
   * Se o Firebase já enviou um payload de
   * notification, o navegador pode exibi-lo
   * automaticamente.
   *
   * Como nossa Edge Function envia mensagens
   * data-only para o chat, normalmente cairemos
   * no bloco abaixo.
   */

  if (
    notification.title ||
    notification.body
  ) {

    return;

  }


  /*
   * TÍTULO DA NOTIFICAÇÃO
   *
   * Será o nome da mesa.
   */

  const title =
    data.title ||
    "A Role Play";


  /*
   * CORPO
   *
   * O formato enviado pela Edge Function será:
   *
   * NomeDoJogador: mensagem
   */

  const body =
    data.body ||
    data.message ||
    "Você recebeu uma nova mensagem.";


  /*
   * Link interno.
   *
   * Ele NÃO aparece visualmente na notificação.
   */

  const link =
    data.link ||
    APP_ROOT;


  /*
   * Notificação Android.
   *
   * O horário é colocado automaticamente pelo Android.
   *
   * Não colocamos URL no body.
   *
   * Não usamos badge para evitar o segundo ícone.
   */

  self.registration.showNotification(
    title,
    {

      body,

      icon: ICON_URL,

      tag:
        data.tableId
          ? `a-role-play-table-${data.tableId}`
          : "a-role-play-message",

      renotify: true,

      data: {

        link,

        tableId:
          data.tableId || "",

        senderUid:
          data.senderUid || "",

        senderName:
          data.senderName || ""

      }

    }

  ).catch((error) => {

    console.error(
      "[A Role Play] ❌ Falha ao exibir notificação:",
      error
    );

  });

});


/* =========================================================
   CLIQUE NA NOTIFICAÇÃO
========================================================= */

self.addEventListener(
  "notificationclick",
  (event) => {

    event.notification.close();


    const target =
      event.notification.data?.link ||
      APP_ROOT;


    event.waitUntil(

      clients
        .matchAll({
          type: "window",
          includeUncontrolled: true
        })

        .then((clientList) => {

          for (const client of clientList) {

            if (
              "focus" in client
            ) {

              if (
                "navigate" in client &&
                target
              ) {

                return client
                  .navigate(target)
                  .then(() => client.focus());

              }

              return client.focus();

            }

          }


          if (
            clients.openWindow
          ) {

            return clients.openWindow(target);

          }

        })

    );

  }
);


/* =========================================================
   FETCH / CACHE
========================================================= */

self.addEventListener(
  "fetch",
  (event) => {

    const request =
      event.request;


    if (
      request.method !== "GET"
    ) {

      return;

    }


    const url =
      new URL(request.url);


    /*
     * Nunca interceptar recursos externos.
     */

    if (
      url.origin !== self.location.origin
    ) {

      return;

    }


    /*
     * Navegação.
     */

    if (
      request.mode === "navigate"
    ) {

      event.respondWith(

        fetch(request)

          .then((response) => {

            if (
              response.ok
            ) {

              const copy =
                response.clone();


              caches
                .open(RUNTIME_CACHE)
                .then((cache) =>
                  cache.put(request, copy)
                );

            }

            return response;

          })

          .catch(async () => {

            const cached =
              (await caches.match(request)) ||

              (await caches.match(INDEX_URL)) ||

              (await caches.match(APP_ROOT));


            return (
              cached ||

              new Response(

                `<!doctype html>

<html lang="pt-BR">

<head>
<meta charset="utf-8">
<title>A Role Play</title>
</head>

<body style="
background:#24140f;
color:#f1dfc1;
font-family:system-ui;
text-align:center;
padding:40px
">

<h1>A Role Play</h1>

<p>Você está offline.</p>

</body>

</html>`,

                {
                  headers: {
                    "Content-Type":
                      "text/html; charset=utf-8"
                  }
                }

              )

            );

          })

      );

      return;

    }


    /*
     * CSS / JS / imagens / fontes.
     */

    if (
      [
        "style",
        "script",
        "image",
        "font"
      ].includes(request.destination)
    ) {

      event.respondWith(

        caches
          .match(request)

          .then((cached) => {

            if (cached) {

              return cached;

            }


            return fetch(request)

              .then((response) => {

                if (
                  !response ||
                  !response.ok
                ) {

                  return response;

                }


                const copy =
                  response.clone();


                caches
                  .open(RUNTIME_CACHE)
                  .then((cache) =>
                    cache.put(request, copy)
                  );


                return response;

              });

          })

      );

    }

  }
);