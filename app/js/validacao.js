/* ============================================================
   Validação.
   Distinção que importa: ERRO trava o salvamento (é sempre
   impossível), AVISO só pergunta "tem certeza?" (é suspeito,
   mas pode ser real). Nunca travar por suspeita — quem está no
   campo sabe mais do que a regra.
   ============================================================ */
import { REGRAS } from './config.js';
import { horasDe, nomeMaquina, brHorimetro } from './planilha.js';

const hoje = () => new Date().toISOString().slice(0, 10);

const brData = (iso) => (iso || '').split('-').reverse().join('/');
const brNum = (n) => String(n).replace('.', ',');

/* ------------------------------------------------------------
   Onde este registro se encaixa na cadeia da máquina.
   Calculado a partir dos registros e SEMPRE relativo à data do
   formulário — nunca a partir de um "último valor" guardado à
   parte. É isso que faz o lançamento retroativo funcionar: a
   ordem em que as coisas foram digitadas deixa de importar.
   ------------------------------------------------------------ */
export function acharVizinhos(registros, maquina, data, ignorarId = null) {
  const vazio = { anterior: null, posterior: null };
  if (!maquina || !data) return vazio;

  const daMaquina = registros.filter((r) =>
    r.maquina === maquina && r.id !== ignorarId
    && Number.isFinite(r.hIni) && Number.isFinite(r.hFim));
  if (!daMaquina.length) return vazio;

  /* anterior: o que termina mais tarde, entre os que não começam
     depois desta data (o mesmo dia conta — pode haver 2 turnos) */
  const anterior = daMaquina
    .filter((r) => r.data <= data)
    .sort((a, b) => a.data.localeCompare(b.data) || a.hFim - b.hFim)
    .pop() || null;

  /* posterior: o próximo da fila depois do anterior */
  const posterior = daMaquina
    .filter((r) => r.data >= data
      && (!anterior || (r.id !== anterior.id && r.hIni >= anterior.hFim)))
    .sort((a, b) => a.data.localeCompare(b.data) || a.hIni - b.hIni)
    .shift() || null;

  return { anterior, posterior };
}

export function validar(r, vizinhos) {
  const erros = [];
  const avisos = [];

  if (!r.data) erros.push('Falta a data.');
  if (!r.operador) erros.push('Falta o operador.');
  if (!r.maquina) erros.push('Falta a máquina.');
  if (!r.local) erros.push('Falta o local.');
  if (!r.atividade) erros.push('Falta o tipo de serviço.');

  const iniVazio = r.hIni === '' || r.hIni === null || r.hIni === undefined || Number.isNaN(r.hIni);
  const fimVazio = r.hFim === '' || r.hFim === null || r.hFim === undefined || Number.isNaN(r.hFim);
  if (iniVazio) erros.push('Falta o horímetro inicial.');
  if (fimVazio) erros.push('Falta o horímetro final.');

  if (!iniVazio && !fimVazio) {
    if (r.hFim < r.hIni) {
      erros.push(`O final (${brHorimetro(r.hFim)}) é menor que o inicial (${brHorimetro(r.hIni)}).`);
    } else if (r.hFim === r.hIni) {
      avisos.push('Inicial e final iguais: vai dar 0 hora.');
    } else {
      const h = horasDe(r);
      if (h > REGRAS.horasMaximasTurno) {
        avisos.push(`${brNum(h)} horas seguidas. Confere?`);
      }
    }
    for (const [rotulo, v] of [['inicial', r.hIni], ['final', r.hFim]]) {
      if (v < REGRAS.horimetroMin || v > REGRAS.horimetroMax) {
        erros.push(`Horímetro ${rotulo} fora da faixa.`);
      }
    }
  }

  if (r.data) {
    if (r.data > hoje()) {
      erros.push('A data está no futuro.');
    } else {
      const dias = Math.round((Date.parse(hoje()) - Date.parse(r.data)) / 86400000);
      if (dias > 7) avisos.push(`Data de ${dias} dias atrás. Confere?`);
    }
  }

  const { anterior, posterior } = vizinhos || {};

  /* Divergência do registro anterior DESTA MÁQUINA, na data.
     Não é erro: outro operador pode ter usado a máquina e o
     registro dele ainda não passou por aqui. Mas é a pista
     mais útil que existe para pegar dígito trocado.           */
  if (anterior && !iniVazio
      && Math.abs(r.hIni - anterior.hFim) > REGRAS.saltoHorimetroAviso) {
    avisos.push(`O registro anterior terminou em ${brHorimetro(anterior.hFim)}. Confere?`);
  }

  /* Invasão do registro seguinte: só aparece em lançamento
     retroativo, e é justamente o caso que ninguém percebe.    */
  if (posterior && !fimVazio && r.hFim > posterior.hIni + 1e-9) {
    avisos.push(`Passa por cima do dia ${brData(posterior.data)}, que começa em ${brHorimetro(posterior.hIni)}.`);
  }

  return { erros, avisos, ok: erros.length === 0 };
}

/* ------------------------------------------------------------
   Conferência da CADEIA, do lado da supervisora: com todos os
   registros juntos dá para ver o que nenhum celular sozinho vê.
   Foi assim que apareceram, no caderno de papel, um horímetro
   andando para trás e um salto de 4 h sem registro.
   ------------------------------------------------------------ */
export function analisarCadeia(registros) {
  const problemas = [];
  const porMaquina = new Map();
  for (const r of registros) {
    if (!porMaquina.has(r.maquina)) porMaquina.set(r.maquina, []);
    porMaquina.get(r.maquina).push(r);
  }

  for (const [maquina, lista] of porMaquina) {
    lista.sort((a, b) => a.data.localeCompare(b.data) || a.hIni - b.hIni);
    for (let i = 0; i < lista.length; i++) {
      const r = lista[i];
      if (r.hFim < r.hIni) {
        problemas.push({ id: r.id, tipo: 'erro',
          texto: `${nomeMaquina(maquina)}: horímetro anda para trás (${brHorimetro(r.hIni)} → ${brHorimetro(r.hFim)}).` });
      }
      const ant = lista[i - 1];
      if (!ant) continue;
      const dif = Math.round((r.hIni - ant.hFim) * 10) / 10;
      if (dif > REGRAS.saltoHorimetroAviso) {
        problemas.push({ id: r.id, tipo: 'aviso',
          texto: `${nomeMaquina(maquina)}: ${brHorimetro(dif)} h entre o fim de ${brData(ant.data)} (${ant.operador}) e o início de ${brData(r.data)} (${r.operador}) sem registro.` });
      } else if (dif < -REGRAS.saltoHorimetroAviso) {
        problemas.push({ id: r.id, tipo: 'aviso',
          texto: `${nomeMaquina(maquina)}: ${brHorimetro(Math.abs(dif))} h contadas duas vezes — ${brData(ant.data)} (${ant.operador}) e ${brData(r.data)} (${r.operador}) se sobrepõem.` });
      }
    }
  }
  return problemas;
}
