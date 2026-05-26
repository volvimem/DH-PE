const CACHE_NAME = 'dhpe-v8-estavel';

// Instala o Service Worker imediatamente
self.addEventListener('install', (event) => {
    self.skipWaiting(); 
});

// Ao ativar, destrói QUALQUER cache antigo que esteja causando a tela branca
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((keys) => {
            return Promise.all(keys.map(key => caches.delete(key)));
        })
    );
    self.clients.claim(); 
});

// Estratégia "Pass-through": Pega da internet direto.
// Se a internet falhar na hora de abrir o app, não dá tela branca,
// ele gera uma resposta vazia para o app não crashar.
self.addEventListener('fetch', (event) => {
    event.respondWith(
        fetch(event.request).catch(() => {
            return new Response(); 
        })
    );
});