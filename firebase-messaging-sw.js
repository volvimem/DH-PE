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

messaging.onBackgroundMessage(function(payload) {
  console.log('[firebase-messaging-sw.js] Recebido em segundo plano ', payload);
});