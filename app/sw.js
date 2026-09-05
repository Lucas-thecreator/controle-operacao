/* Service worker: é ele que faz o app abrir sem rede nenhuma.
   Estratégia: cache primeiro, rede só para atualizar em segundo
   plano. Quem está no campo nunca espera por rede.            */

const CACHE = 'controle-operacao-v1';

const ARQUIVOS = [
  './',
  './index.html',
  './styles.css',
  './manifest.json',
  './vendor/qrcode.js',
  './vendor/jsQR.js',
  './js/app.js',
  './js/config.js',
  './js/db.js',
  './js/pack.js',
  './js/planilha.js',
  './js/validacao.js',
  './js/operador.js',
  './js/entrega.js',
  './js/supervisora.js',
  './js/xlsxgen.js',
  './icons/icone-192.png',
  './icons/icone-512.png',
];

self.addEventListener('install', (ev) => {
  ev.waitUntil(
    caches.open(CACHE)
      .then((c) => c.addAll(ARQUIVOS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (ev) => {
  ev.waitUntil(
    caches.keys()
      .then((nomes) => Promise.all(
        nomes.filter((n) => n !== CACHE).map((n) => caches.delete(n))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (ev) => {
  if (ev.request.method !== 'GET') return;

  ev.respondWith(
    caches.match(ev.request).then((guardado) => {
      const daRede = fetch(ev.request)
        .then((resposta) => {
          if (resposta && resposta.ok) {
            const copia = resposta.clone();
            caches.open(CACHE).then((c) => c.put(ev.request, copia));
          }
          return resposta;
        })
        .catch(() => guardado);

      /* offline responde na hora pelo cache; online devolve o
         cache também e aproveita a rede só para atualizar     */
      return guardado || daRede;
    })
  );
});
