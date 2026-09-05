/* Gera o hash do código de acesso para colar em config.js.
   Usa exatamente a mesma função que o app usa para conferir.

   Uso:  npm run codigo -- "o-codigo-que-voce-quiser"          */
import { derivar } from '../app/js/codigo.js';
import { CODIGO_SAL } from '../app/js/config.js';

const codigo = process.argv[2];

if (!codigo) {
  console.log('\nUso: npm run codigo -- "seu-codigo-aqui"\n');
  console.log('Escolha algo com 10+ caracteres e letras. Um código de 4');
  console.log('dígitos cai por força bruta em minutos, mesmo com hash.\n');
  process.exit(1);
}

if (codigo.length < 8) {
  console.log(`\nAVISO: "${codigo}" tem só ${codigo.length} caracteres.`);
  console.log('Gerando assim mesmo, mas considere algo mais longo.\n');
}

const hash = await derivar(codigo, CODIGO_SAL);

console.log('\nCole em app/js/config.js:\n');
console.log(`export const CODIGO_HASH = '${hash}';`);
console.log('\nE guarde o código em si num lugar seguro — ele não aparece');
console.log('em lugar nenhum do projeto, só este hash.\n');
