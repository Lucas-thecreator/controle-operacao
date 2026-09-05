/* ============================================================
   Tela do operador.
   Duas obsessões aqui:
   1) não perder registro — grava local, sempre, e nunca apaga
      o que já foi entregue;
   2) data e máquina continuam por lista (evitam erro de digitação
      em algo que é sempre o mesmo conjunto fechado); os demais
      campos são texto livre, e a conta das horas aparece antes
      de salvar.
   ============================================================ */
import { MAQUINAS } from './config.js';
import * as db from './db.js';
import { validar, acharVizinhos } from './validacao.js';
import { horasDe, nomeMaquina, brHorimetro } from './planilha.js';
import { empacotar } from './pack.js';
import { esc } from './texto.js';

const $ = (s, raiz = document) => raiz.querySelector(s);
const hoje = () => new Date().toISOString().slice(0, 10);
const brData = (iso) => (iso || '').split('-').reverse().join('/');
const brNum = (n) => String(n).replace('.', ',');
const num = (v) => {
  const s = String(v ?? '').trim().replace(',', '.');
  return s === '' ? NaN : Number(s);
};
const novoId = () =>
  Date.now().toString(36).slice(-5) + Math.random().toString(36).slice(2, 5);

const form = $('#form-registro');
let avisosAceitos = false;   // segundo toque confirma o que é só suspeito
let aoEntregar = null;       // callback para trocar de tela

/* ---------- montagem dos campos ---------- */
function encher(select, itens, { vazio = null } = {}) {
  select.innerHTML = '';
  if (vazio !== null) select.append(new Option(vazio, ''));
  for (const it of itens) {
    const [valor, rotulo] = Array.isArray(it) ? it : [it, it];
    select.append(new Option(rotulo, valor));
  }
}

/* ---------- mensagens ---------- */
const caixa = $('#mensagens');
const limparMensagens = () => { caixa.innerHTML = ''; };

function mostrar(tipo, titulo, itens) {
  const div = document.createElement('div');
  div.className = 'msg ' + tipo;
  div.innerHTML = '<strong>' + esc(titulo) + '</strong>' +
    itens.map((t) => '<div>' + esc(t) + '</div>').join('');
  caixa.append(div);
}

/* O horímetro inicial NÃO é preenchido pelo app, de propósito.
   Ele é uma leitura do painel da máquina, não um número que dê
   para deduzir. Sugerir o valor convidava o operador a aceitar
   sem olhar — e aí o campo virava cópia do registro anterior em
   vez de observação, deixando a cadeia bonita e talvez errada.
   A conferência continua, só que na hora de salvar: comparar
   uma leitura real com a expectativa é útil; fabricá-la, não. */

function atualizarConta() {
  const alvo = $('#conta-horas');
  const ini = num(form.elements.hIni.value);
  const fim = num(form.elements.hFim.value);
  if (Number.isNaN(ini) || Number.isNaN(fim)) { alvo.hidden = true; return; }
  const h = Math.round((fim - ini) * 10) / 10;
  alvo.hidden = false;
  alvo.textContent = h < 0
    ? `Isso daria ${brNum(h)} hora — o final está menor que o inicial.`
    : `${brNum(h)} hora${h === 1 ? '' : 's'} trabalhada${h === 1 ? '' : 's'}.`;
  alvo.style.background = h < 0 ? 'var(--erro-fundo)' : 'var(--ok-fundo)';
  alvo.style.color = h < 0 ? 'var(--erro)' : 'var(--ok)';
}

/* ---------- lista e pendências ---------- */
async function pintarLista() {
  const registros = await db.listarRegistros();
  const lista = $('#lista-registros');
  const pendentes = registros.filter((r) => !r.entregue);

  const banner = $('#aviso-pendentes');
  if (pendentes.length) {
    const antigo = pendentes.map((r) => r.data).sort()[0];
    banner.hidden = false;
    banner.textContent = `${pendentes.length} registro${pendentes.length === 1 ? '' : 's'} `
      + `ainda não entregue${pendentes.length === 1 ? '' : 's'} — o mais antigo é de ${brData(antigo)}.`;
  } else {
    banner.hidden = true;
  }

  const botao = $('#btn-entregar');
  botao.hidden = pendentes.length === 0;
  botao.textContent = `Entregar ${pendentes.length} registro${pendentes.length === 1 ? '' : 's'}`;

  const entregues = registros.length - pendentes.length;
  $('#contador-registros').textContent = !registros.length ? ''
    : entregues ? `(${pendentes.length} a entregar · ${entregues} entregue${entregues === 1 ? '' : 's'})`
    : `(${pendentes.length} a entregar)`;

  if (!registros.length) {
    lista.innerHTML = '<li class="vazio">Nenhum registro ainda.</li>';
    return;
  }

  const ordem = [...pendentes.reverse(),
    ...registros.filter((r) => r.entregue).reverse()].slice(0, 40);

  lista.innerHTML = '';
  for (const r of ordem) {
    const li = document.createElement('li');
    if (r.entregue) li.className = 'entregue';
    const info = document.createElement('div');
    info.innerHTML =
      `<div class="quando">${brData(r.data)} · ${esc(nomeMaquina(r.maquina))}</div>` +
      `<div class="detalhe">${esc(r.operador)} · ${esc(r.local)}${r.vala ? ' · vala ' + esc(r.vala) : ''} · ${esc(r.atividade)}</div>` +
      `<div class="detalhe">${brHorimetro(r.hIni)} → ${brHorimetro(r.hFim)}${r.entregue ? ' · entregue' : ''}</div>`;
    const lado = document.createElement('div');
    lado.innerHTML = `<span class="horas">${brNum(horasDe(r))} h</span>`;
    if (!r.entregue) {
      const x = document.createElement('button');
      x.className = 'apagar';
      x.textContent = '×';
      x.title = 'Apagar este registro';
      x.addEventListener('click', async () => {
        if (!confirm(`Apagar o registro de ${brData(r.data)}, ${brNum(horasDe(r))} h?`)) return;
        await db.apagarRegistro(r.id);
        pintarLista();
      });
      lado.append(x);
    }
    li.append(info, lado);
    lista.append(li);
  }
}

/* ---------- salvar ---------- */
async function salvar(ev) {
  ev.preventDefault();
  limparMensagens();

  const registro = {
    id: novoId(),
    data: form.elements.data.value,
    operador: form.elements.operador.value.trim(),
    maquina: form.elements.maquina.value,
    hIni: num(form.elements.hIni.value),
    hFim: num(form.elements.hFim.value),
    local: form.elements.local.value.trim(),
    vala: form.elements.vala.value.trim(),
    atividade: form.elements.atividade.value.trim(),
    obs: form.elements.obs.value.trim(),
    criadoEm: new Date().toISOString(),
    entregue: false,
  };

  const vizinhos = acharVizinhos(await db.listarRegistros(), registro.maquina, registro.data);
  const { erros, avisos } = validar(registro, vizinhos);

  if (erros.length) {
    avisosAceitos = false;
    mostrar('erro', 'Falta corrigir:', erros);
    caixa.scrollIntoView({ behavior: 'smooth', block: 'center' });
    return;
  }

  if (avisos.length && !avisosAceitos) {
    avisosAceitos = true;
    mostrar('aviso', 'Confere antes de salvar:', avisos);
    const botao = form.querySelector('button[type="submit"]');
    botao.textContent = 'Está certo, pode salvar';
    caixa.scrollIntoView({ behavior: 'smooth', block: 'center' });
    return;
  }

  await db.salvarRegistro(registro);

  /* o que quase sempre se repete fica guardado para o próximo */
  await db.guardar('ultimoOperador', registro.operador);
  await db.guardar('ultimaMaquina', registro.maquina);

  avisosAceitos = false;
  form.querySelector('button[type="submit"]').textContent = 'Salvar registro';

  form.elements.hIni.value = '';
  form.elements.hFim.value = '';
  form.elements.obs.value = '';
  $('#conta-horas').hidden = true;

  mostrar('ok', 'Registro salvo.', [
    `${brData(registro.data)} · ${nomeMaquina(registro.maquina)} · ${brNum(horasDe(registro))} h`,
  ]);
  setTimeout(limparMensagens, 4000);

  await pintarLista();
}

/* ---------- entrada ---------- */
export async function iniciarOperador(irParaEntrega) {
  aoEntregar = irParaEntrega;

  encher(form.elements.maquina, MAQUINAS.map((m) => [m.id, m.nome]), { vazio: 'Escolha…' });

  form.elements.data.value = hoje();
  form.elements.data.max = hoje();

  const [op, mq] = await Promise.all([db.ler('ultimoOperador'), db.ler('ultimaMaquina')]);
  if (op) form.elements.operador.value = op;
  if (mq) form.elements.maquina.value = mq;

  form.elements.hIni.addEventListener('input', atualizarConta);
  form.elements.hFim.addEventListener('input', atualizarConta);
  form.addEventListener('input', () => {
    if (!avisosAceitos) return;
    avisosAceitos = false;
    form.querySelector('button[type="submit"]').textContent = 'Salvar registro';
  });
  form.addEventListener('submit', salvar);

  $('#btn-entregar').addEventListener('click', async () => {
    const pendentes = (await db.listarRegistros()).filter((r) => !r.entregue);
    if (!pendentes.length) return;
    aoEntregar(empacotar(pendentes), pendentes);
  });

  await pintarLista();
}

export const recarregarLista = pintarLista;
