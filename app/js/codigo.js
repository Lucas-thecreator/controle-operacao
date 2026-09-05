/* ============================================================
   Verificação do código do modo "Faço a planilha".

   O repositório é público, então o código não pode ficar em
   texto puro no fonte. Guardamos só o resultado de um PBKDF2
   com 200 mil iterações — que é lento de propósito: cada
   tentativa custa ~100 ms mesmo para quem está atacando.

   Sendo honesto sobre o limite: isso encarece a força bruta,
   não a impede. Um código de 4 dígitos são 10 mil tentativas,
   ~17 minutos para alguém decidido. Um código de 10 caracteres
   com letras leva mais tempo que a vida útil do aterro.
   Sem servidor não dá para fazer melhor — e não há servidor
   justamente porque não há internet no local.
   ============================================================ */
import { CODIGO_SAL, CODIGO_HASH } from './config.js';

/* 600 mil é a recomendação atual da OWASP para PBKDF2-SHA256.
   Custa ~80 ms uma única vez para ela; triplica o custo de quem
   tenta adivinhar.                                             */
const ITERACOES = 600000;

export async function derivar(codigo, sal = CODIGO_SAL) {
  const cod = new TextEncoder();
  const chave = await crypto.subtle.importKey(
    'raw', cod.encode(codigo), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt: cod.encode(sal), iterations: ITERACOES, hash: 'SHA-256' },
    chave, 256);
  return [...new Uint8Array(bits)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export const temCripto = () => !!(globalThis.crypto && globalThis.crypto.subtle);

export async function confere(digitado) {
  if (!temCripto()) return false;
  return (await derivar(digitado)) === CODIGO_HASH;
}
