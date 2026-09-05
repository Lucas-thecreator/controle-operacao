/* ============================================================
   Formato de transporte por QR code.
   Objetivo: caber MUITA linha em POUCO pixel, porque quem lê é
   uma câmera apontada para uma tela — quanto menos denso o QR,
   mais rápido e confiável o scan.
   Truque principal: valores de lista viram índices (1 caractere
   em vez de "Compactação de resíduos").
   ============================================================ */
import { MAQUINAS, OPERADORES, LOCAIS, ATIVIDADES } from './config.js';

const VERSAO = 'S1';
const BYTES_POR_QR = 400;   // mantém o QR em ~57-85 módulos: lê de primeira

/* encodeURIComponent já protege "," e "|"; falta "~" e "*"    */
const esc = (s) => encodeURIComponent(String(s ?? ''))
  .replace(/~/g, '%7E').replace(/\*/g, '%2A');
const desesc = (s) => decodeURIComponent(s || '');

/* valor de lista -> índice, ou "*texto" quando for "Outro"    */
function comprimir(valor, lista) {
  const i = lista.indexOf(valor);
  return i >= 0 ? String(i) : '*' + esc(valor);
}
function descomprimir(campo, lista) {
  if (campo === '') return '';
  if (campo[0] === '*') return desesc(campo.slice(1));
  const i = Number(campo);
  return lista[i] !== undefined ? lista[i] : '';
}

const idsMaquinas = MAQUINAS.map((m) => m.id);
const dataCompacta = (iso) => iso.slice(2).replace(/-/g, '');            // 2026-09-04 -> 260904
const dataLonga = (c) => `20${c.slice(0, 2)}-${c.slice(2, 4)}-${c.slice(4, 6)}`;

function linha(r) {
  return [
    r.id,
    dataCompacta(r.data),
    comprimir(r.operador, OPERADORES),
    comprimir(r.maquina, idsMaquinas),
    String(r.hIni),
    String(r.hFim),
    comprimir(r.local, LOCAIS),
    esc(r.vala || ''),
    comprimir(r.atividade, ATIVIDADES),
    esc(r.obs || ''),
  ].join(',');
}

function deLinha(txt) {
  const c = txt.split(',');
  if (c.length < 9) return null;
  return {
    id: c[0],
    data: dataLonga(c[1]),
    operador: descomprimir(c[2], OPERADORES),
    maquina: descomprimir(c[3], idsMaquinas),
    hIni: Number(c[4]),
    hFim: Number(c[5]),
    local: descomprimir(c[6], LOCAIS),
    vala: desesc(c[7]),
    atividade: descomprimir(c[8], ATIVIDADES),
    obs: desesc(c[9] || ''),
    criadoEm: 0,
    entregue: true,
  };
}

/* ---- geração: array de registros -> array de strings de QR ---- */
export function empacotar(registros) {
  const sid = Math.random().toString(36).slice(2, 7);
  const linhas = registros.map(linha);
  const blocos = [];
  let atual = [];
  let tamanho = 0;
  for (const l of linhas) {
    if (atual.length && tamanho + l.length + 1 > BYTES_POR_QR) {
      blocos.push(atual); atual = []; tamanho = 0;
    }
    atual.push(l); tamanho += l.length + 1;
  }
  if (atual.length) blocos.push(atual);
  if (!blocos.length) return [];
  return blocos.map((b, i) =>
    `${VERSAO}|${i + 1}|${blocos.length}|${sid}|${b.join('~')}`);
}

/* ---- leitura: junta as partes até fechar o conjunto ---- */
export class Montador {
  constructor() { this.sid = null; this.total = 0; this.partes = new Map(); }

  /* devolve {ok, estado, registros?} — "estado" alimenta a UI  */
  receber(texto) {
    const m = /^S1\|(\d+)\|(\d+)\|([a-z0-9]+)\|([\s\S]*)$/.exec(texto || '');
    if (!m) return { ok: false, estado: 'nao-e-nosso' };
    const [, parte, total, sid, corpo] = m;

    if (this.sid && this.sid !== sid) { this.sid = null; this.partes.clear(); }
    this.sid = sid;
    this.total = Number(total);

    const jaTinha = this.partes.has(Number(parte));
    this.partes.set(Number(parte), corpo);

    if (this.partes.size < this.total) {
      return {
        ok: true, estado: 'parcial', repetida: jaTinha,
        lidas: this.partes.size, total: this.total,
        faltando: Array.from({ length: this.total }, (_, i) => i + 1)
          .filter((n) => !this.partes.has(n)),
      };
    }

    const registros = [];
    for (let i = 1; i <= this.total; i++) {
      for (const l of this.partes.get(i).split('~')) {
        const r = deLinha(l);
        if (r) registros.push(r);
      }
    }
    const partesLidas = this.total;
    this.sid = null; this.partes.clear(); this.total = 0;
    return { ok: true, estado: 'completo', registros, partes: partesLidas };
  }
}
