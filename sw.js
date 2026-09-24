// ==========================================================
// PARTE 1: FIREBASE PUSH NOTIFICATIONS
// ==========================================================
importScripts('https://www.gstatic.com/firebasejs/9.6.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.6.1/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: "AIzaSyDilUDfyFsebnbQ9pAXyL7ptbSy5CY_cmk",
  authDomain: "fpc-per.firebaseapp.com",
  databaseURL: "https://fpc-per-default-rtdb.firebaseio.com",
  projectId: "fpc-per",
  storageBucket: "fpc-per.firebasestorage.app",
  messagingSenderId: "817616563956",
  appId: "1:817616563956:web:21dbbbcbb69e0cae10f8a1"
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {

    console.log(
        "[SW] Push recebido em segundo plano:",
        payload
    );

    // Se a mensagem já possui "notification",
    // o próprio Firebase/Chrome mostra o aviso.
    // Não mostramos novamente para evitar duplicidade.
    if (payload && payload.notification) {

        console.log(
            "[SW] Notificação visual será exibida pelo Firebase/Chrome."
        );

        return;
    }

    // Fallback para mensagens antigas enviadas somente com DATA.
    const titulo =
        payload?.data?.title ||
        "DH-PE";

    const corpo =
        payload?.data?.body ||
        "Você recebeu uma nova notificação.";

    const options = {

        body: corpo,

        icon: "./logo.png",
        badge: "./logo.png",

        vibrate: [200, 100, 200],

        tag: "dhpe-" + Date.now(),

        renotify: true,

        data: {
            url: "./"
        }
    };

    return self.registration.showNotification(
        titulo,
        options
    );
});

// ==========================================================
// CLIQUE NA NOTIFICAÇÃO
// ==========================================================

self.addEventListener("notificationclick", (event) => {

    console.log(
        "[SW] Usuário clicou na notificação."
    );

    event.notification.close();

    const url =
        event.notification.data &&
        event.notification.data.url
            ? event.notification.data.url
            : "./";

    event.waitUntil(

        clients.matchAll({
            type: "window",
            includeUncontrolled: true
        }).then((clientList) => {

            for (const client of clientList) {

                if ("focus" in client) {

                    client.navigate(url);

                    return client.focus();
                }
            }

            if (clients.openWindow) {

                return clients.openWindow(url);
            }
        })
    );
});

// ==========================================================
// PARTE 2: PWA E CACHE
// ==========================================================
const CACHE_NAME = 'dhpe-v10-x1';

self.addEventListener('install', (event) => {
    self.skipWaiting(); 
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((keys) => {
            return Promise.all(keys.map(key => caches.delete(key)));
        })
    );
    self.clients.claim(); 
});

self.addEventListener('fetch', (event) => {
    event.respondWith(
        fetch(event.request).catch(() => {
            return new Response(); 
        })
    );
});
