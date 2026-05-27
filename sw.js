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
  console.log('[sw.js] Notificação recebida. O navegador exibirá nativamente!', payload);
  // 🔥 A SOLUÇÃO ESTÁ AQUI: 
  // O Firebase já mostra a notificação nativamente porque o servidor envia o bloco "notification".
  // Se chamássemos o comando showNotification aqui, ele mostraria duplicado.
});

// ==========================================================
// PARTE 2: PWA E CACHE
// ==========================================================
const CACHE_NAME = 'dhpe-v8-estavel';

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
