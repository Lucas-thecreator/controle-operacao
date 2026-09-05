/* ============================================================
   Contrato de saída para o Excel.
   As 8 primeiras colunas são EXATAMENTE as que ela já usa hoje,
   na mesma ordem. "Vala" e "Observação" entram no fim, então
   quem já tem a planilha antiga pode simplesmente ignorá-las.

   Duas colunas nunca mais precisam ser digitadas:
     - "Máquina" vem do caderno/aparelho escolhido;
     - "Horas trabalhada" é subtração pura.
   ============================================================ */
import { MAQUINAS } from './config.js';

export const COLUNAS = [
  { titulo: 'Data',             campo: 'data',      tipo: 'data',   largura: 12 },
  { titulo: 'Operador',         campo: 'operador',  tipo: 'texto',  largura: 14 },
  { titulo: 'Máquina',          campo: 'maquina',   tipo: 'texto',  largura: 18 },
  { titulo: 'H inicial',        campo: 'hIni',      tipo: 'numero', largura: 11 },
  { titulo: 'H final',          campo: 'hFim',      tipo: 'numero', largura: 11 },
  { titulo: 'Horas trabalhada', campo: 'horas',     tipo: 'numero', largura: 16 },
  { titulo: 'Local',            campo: 'local',     tipo: 'texto',  largura: 14 },
  { titulo: 'Tipo de serviço',  campo: 'atividade', tipo: 'texto',  largura: 26 },
  { titulo: 'Vala',             campo: 'vala',      tipo: 'texto',  largura: 8  },
  { titulo: 'Observação',       campo: 'obs',       tipo: 'texto',  largura: 30 },
];

export const horasDe = (r) => Math.round((r.hFim - r.hIni) * 10) / 10;

/* Horímetro na tela sempre com uma casa, como aparece no painel
   da máquina. "3050" e "3050,0" são o mesmo número, mas só o
   segundo parece a leitura que o operador acabou de fazer.     */
export const brHorimetro = (n) => Number(n).toFixed(1).replace('.', ',');

export const rotuloMaquina = (id) => {
  const m = MAQUINAS.find((x) => x.id === id);
  return m ? m.planilha : id;
};

export const nomeMaquina = (id) => {
  const m = MAQUINAS.find((x) => x.id === id);
  return m ? m.nome : id;
};

export function paraPlanilha(registros) {
  return registros
    .slice()
    .sort((a, b) => a.data.localeCompare(b.data)
      || rotuloMaquina(a.maquina).localeCompare(rotuloMaquina(b.maquina))
      || a.hIni - b.hIni)
    .map((r) => ({
      data: r.data,
      operador: r.operador,
      maquina: rotuloMaquina(r.maquina),
      hIni: r.hIni,
      hFim: r.hFim,
      horas: horasDe(r),
      local: r.local,
      atividade: r.atividade,
      vala: r.vala || '',
      obs: r.obs || '',
    }));
}

/* CSV com BOM e ";" — o Excel em português abre direto,
   sem passar pelo assistente de importação.                   */
export function paraCsv(registros) {
  const linhas = paraPlanilha(registros);
  const campo = (v) => {
    const s = String(v ?? '');
    return /[";\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  };
  const brData = (iso) => iso.split('-').reverse().join('/');
  const brNum = (n) => String(n).replace('.', ',');

  const saida = [COLUNAS.map((c) => campo(c.titulo)).join(';')];
  for (const l of linhas) {
    saida.push(COLUNAS.map((c) => {
      const v = l[c.campo];
      if (c.tipo === 'data') return campo(brData(v));
      if (c.tipo === 'numero') return campo(brNum(v));
      return campo(v);
    }).join(';'));
  }
  return '﻿' + saida.join('\r\n');
}
