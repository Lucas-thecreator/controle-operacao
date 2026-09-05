/* Gera os ícones do app. PNG cru: assinatura + IHDR + IDAT + IEND.
   O zlib do próprio Node faz a compressão, então não entra
   dependência nova no projeto por causa de dois quadradinhos.
   Rodar com: npm run icones                                    */
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

const TABELA = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    t[n] = c >>> 0;
  }
  return t;
})();
const crc32 = (buf) => {
  let c = 0xFFFFFFFF;
  for (const b of buf) c = TABELA[(c ^ b) & 0xFF] ^ (c >>> 8);
  return (c ^ 0xFFFFFFFF) >>> 0;
};

function chunk(tipo, dados) {
  const tamanho = Buffer.alloc(4);
  tamanho.writeUInt32BE(dados.length);
  const corpo = Buffer.concat([Buffer.from(tipo, 'ascii'), dados]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(corpo));
  return Buffer.concat([tamanho, corpo, crc]);
}

function png(largura, altura, pixels) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(largura, 0);
  ihdr.writeUInt32BE(altura, 4);
  ihdr[8] = 8;    // 8 bits por canal
  ihdr[9] = 2;    // RGB
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(pixels, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

/* Um horímetro: anel branco com dois ponteiros, sobre o azul
   da planilha. Legível mesmo no tamanho de 48px da gaveta.   */
function desenhar(lado) {
  const FUNDO = [0x2F, 0x55, 0x97];
  const TRACO = [0xFF, 0xFF, 0xFF];

  const linhas = Buffer.alloc(lado * (lado * 3 + 1));
  const centro = lado / 2;
  const raio = lado * 0.30;
  const espessura = Math.max(2, lado * 0.075);
  const ponteiro = Math.max(2, lado * 0.055);

  for (let y = 0; y < lado; y++) {
    const base = y * (lado * 3 + 1);
    linhas[base] = 0;                       // filtro "none"
    for (let x = 0; x < lado; x++) {
      const dx = x - centro;
      const dy = y - centro;
      const dist = Math.hypot(dx, dy);

      const noAnel = Math.abs(dist - raio) <= espessura / 2;
      /* ponteiro para cima (12h) e para a direita (3h) */
      const paraCima = Math.abs(dx) <= ponteiro / 2 && dy <= 0 && dy >= -raio * 0.80;
      const paraDireita = Math.abs(dy) <= ponteiro / 2 && dx >= 0 && dx <= raio * 0.58;

      const cor = (noAnel || paraCima || paraDireita) ? TRACO : FUNDO;
      const p = base + 1 + x * 3;
      linhas[p] = cor[0]; linhas[p + 1] = cor[1]; linhas[p + 2] = cor[2];
    }
  }
  return png(lado, lado, linhas);
}

const destino = path.join(process.cwd(), 'app', 'icons');
fs.mkdirSync(destino, { recursive: true });
for (const lado of [192, 512]) {
  const arquivo = path.join(destino, `icone-${lado}.png`);
  fs.writeFileSync(arquivo, desenhar(lado));
  console.log(`  ${arquivo} (${fs.statSync(arquivo).size} bytes)`);
}
console.log('ícones gerados');
