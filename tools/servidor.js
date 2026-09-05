/* Servidor estático só para desenvolvimento.
   localhost conta como origem segura, então service worker e
   câmera funcionam aqui igual funcionariam no ar.
   Rodar com: npm run servir                                    */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

const RAIZ = path.join(process.cwd(), 'app');
const PORTA = Number(process.env.PORTA || 8080);

const TIPOS = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/manifest+json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
};

http.createServer((req, res) => {
  const caminho = decodeURIComponent(req.url.split('?')[0]);
  const relativo = caminho === '/' ? 'index.html' : caminho.replace(/^\/+/, '');
  const arquivo = path.join(RAIZ, relativo);

  if (!arquivo.startsWith(RAIZ)) { res.writeHead(403).end('fora da raiz'); return; }

  fs.readFile(arquivo, (erro, dados) => {
    if (erro) {
      res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
      res.end('não encontrado: ' + relativo);
      return;
    }
    res.writeHead(200, {
      'content-type': TIPOS[path.extname(arquivo)] || 'application/octet-stream',
      'cache-control': 'no-store',   // durante o desenvolvimento, nunca servir velho
    });
    res.end(dados);
  });
}).listen(PORTA, () => {
  console.log(`app em http://localhost:${PORTA}`);
});
