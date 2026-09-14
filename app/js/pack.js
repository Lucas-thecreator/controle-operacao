/* ============================================================
   Formato de transporte por QR code.
   Objetivo: caber MUITA linha em POUCO pixel, porque quem lê é
   uma câmera apontada para uma tela — quanto menos denso o QR,
   mais rápido e confiável o scan.

   S2 (atual): cada envio leva o próprio dicionário. Todo texto
   que aparece (operador, máquina, local, serviço, vala, obs) vai
   UMA vez no começo, e as linhas apontam para ele por número.
   "Compactação de Resíduos" 30 vezes na semana custa o texto
   uma vez só.

   Por que não usar as listas de config.js como dicionário, como
   o S1 fazia: o celular do operador só se atualiza quando vê
   internet. Celular com lista velha + supervisora com lista nova
   = "serviço nº 3" vira outro serviço, sem erro nenhum. Com o
   dicionário dentro do QR, a versão de cada aparelho não importa.
   ============================================================ */

const BYTES_POR_QR = 400;   // mantém o QR em ~57-85 módulos: lê de primeira

/* encodeURIComponent já protege "," "|" "#" e espaço; falta "~" e "*" */
const esc = (s) => encodeURIComponent(String(s ?? ''))
  .replace(/~/g, '%7E').replace(/\*/g, '%2A');

/* QR adulterado não pode derrubar a leitura dos outros */
const desesc = (s) => {
  try { return decodeURIComponent(s || ''); } catch { return ''; }
};

const dataCompacta = (iso) => iso.slice(2).replace(/-/g, '');            // 2026-09-04 -> 260904
const dataLonga = (c) => `20${c.slice(0, 2)}-${c.slice(2, 4)}-${c.slice(4, 6)}`;

/* ---------------- S2: geração ---------------- */
export function empacotar(registros) {
  if (!registros.length) return [];

  const termos = [];
  const posicao = new Map();
  const ref = (valor) => {
    const s = String(valor ?? '');
    if (s === '') return '';
    if (!posicao.has(s)) { posicao.set(s, termos.length); termos.push(s); }
    return posicao.get(s).toString(36);
  };

  const linhas = registros.map((r) => [
    r.id,
    dataCompacta(r.data),
    ref(r.operador),
    ref(r.maquina),
    String(r.hIni),
    String(r.hFim),
    ref(r.local),
    ref(r.vala),
    ref(r.atividade),
    ref(r.obs),
  ].join(','));

  const corpo = termos.map(esc).join(',') + '#' + linhas.join('~');

  /* corta em pedaços do mesmo tamanho; quem recebe junta tudo
     antes de ler, então o corte pode cair em qualquer lugar    */
  const pedacos = [];
  for (let i = 0; i < corpo.length; i += BYTES_POR_QR) {
    pedacos.push(corpo.slice(i, i + BYTES_POR_QR));
  }
  const sid = Math.random().toString(36).slice(2, 7).padEnd(5, '0');
  return pedacos.map((p, i) => `S2|${i + 1}|${pedacos.length}|${sid}|${p}`);
}

/* ---------------- S2: leitura ---------------- */
function lerS2(corpo) {
  const corte = corpo.indexOf('#');
  if (corte < 0) return [];
  const cabeca = corpo.slice(0, corte);
  const termos = cabeca === '' ? [] : cabeca.split(',').map(desesc);
  const termo = (c) => (c === '' ? '' : (termos[parseInt(c, 36)] ?? ''));

  return corpo.slice(corte + 1).split('~').map((txt) => {
    const c = txt.split(',');
    if (c.length !== 10 || !c[0]) return null;
    return {
      id: c[0],
      data: dataLonga(c[1]),
      operador: termo(c[2]),
      maquina: termo(c[3]),
      hIni: Number(c[4]),
      hFim: Number(c[5]),
      local: termo(c[6]),
      vala: termo(c[7]),
      atividade: termo(c[8]),
      obs: termo(c[9]),
      criadoEm: 0,
      entregue: true,
    };
  }).filter(Boolean);
}

/* ---------------- S1: só leitura ----------------
   Formato antigo, que mandava a POSIÇÃO na lista em vez do texto.
   Continua sendo lido porque celular sem internet pode passar
   semanas sem atualizar. As listas abaixo são as da época,
   congeladas — NÃO editar, nem quando config.js mudar.         */
const LISTAS_S1 = {
  maquinas: ['EH05', 'EH09', 'EP02', 'PP01', 'RE01', 'TE03', 'TEA279', 'TEA340', 'TP44', 'TP45', 'TP52'],
  operadores: ['Armando', 'Elismar', 'Glauber', 'Gustavo', 'Pedro'],
  locais: ['Classe I', 'Classe II', 'Classe II A'],
  atividades: ['Compactação de resíduos', 'Empurrar material', 'Cobertura de manta',
    'Ampliação Classe II', 'Rampa', 'Pátio'],
};

function valorS1(campo, lista) {
  if (!campo) return '';
  if (campo[0] === '*') return desesc(campo.slice(1));
  return lista[Number(campo)] ?? '';
}

function lerS1(corpo) {
  return corpo.split('~').map((txt) => {
    const c = txt.split(',');
    if (c.length < 9) return null;
    return {
      id: c[0],
      data: dataLonga(c[1]),
      operador: valorS1(c[2], LISTAS_S1.operadores),
      maquina: valorS1(c[3], LISTAS_S1.maquinas),
      hIni: Number(c[4]),
      hFim: Number(c[5]),
      local: valorS1(c[6], LISTAS_S1.locais),
      vala: desesc(c[7]),
      atividade: valorS1(c[8], LISTAS_S1.atividades),
      obs: desesc(c[9] || ''),
      criadoEm: 0,
      entregue: true,
    };
  }).filter(Boolean);
}

/* ---- leitura: junta as partes até fechar o conjunto ---- */
export class Montador {
  constructor() { this.limpar(); }

  limpar() { this.sid = null; this.versao = null; this.total = 0; this.partes = new Map(); }

  /* devolve {ok, estado, registros?} — "estado" alimenta a UI  */
  receber(texto) {
    const m = /^(S[12])\|(\d+)\|(\d+)\|([a-z0-9]+)\|([\s\S]*)$/.exec(texto || '');
    if (!m) return { ok: false, estado: 'nao-e-nosso' };
    const [, versao, parteTxt, totalTxt, sid, corpo] = m;
    const parte = Number(parteTxt);
    const total = Number(totalTxt);
    if (parte < 1 || parte > total) return { ok: false, estado: 'nao-e-nosso' };

    if (this.sid !== sid || this.versao !== versao) this.limpar();
    this.sid = sid;
    this.versao = versao;
    this.total = total;

    const repetida = this.partes.has(parte);
    this.partes.set(parte, corpo);

    if (this.partes.size < this.total) {
      return {
        ok: true, estado: 'parcial', repetida,
        lidas: this.partes.size, total: this.total,
        faltando: Array.from({ length: this.total }, (_, i) => i + 1)
          .filter((n) => !this.partes.has(n)),
      };
    }

    const emOrdem = Array.from({ length: this.total }, (_, i) => this.partes.get(i + 1));
    const registros = versao === 'S2' ? lerS2(emOrdem.join('')) : lerS1(emOrdem.join('~'));
    const partesLidas = this.total;
    this.limpar();
    return { ok: true, estado: 'completo', registros, partes: partesLidas };
  }
}
