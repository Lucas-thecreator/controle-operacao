/* Arranque e navegação entre as telas. */
import * as db from './db.js';
import { confere, temCripto } from './codigo.js';
import { iniciarOperador, recarregarLista } from './operador.js';
import { ligarEntrega, abrirEntrega } from './entrega.js';
import { iniciarSupervisora, pararTudo } from './supervisora.js';

const $ = (s) => document.querySelector(s);
const TELAS = ['#tela-inicio', '#tela-operador', '#tela-entrega', '#tela-supervisora'];

let operadorPronto = false;
let supervisoraPronta = false;

function mostrarTela(alvo) {
  for (const t of TELAS) $(t).hidden = t !== alvo;
  window.scrollTo(0, 0);
}

/* ---------- trava do modo "Faço a planilha" ---------- */
function mostrarTrava(ligada) {
  $('#trava-supervisora').hidden = !ligada;
  for (const el of document.querySelectorAll('#tela-inicio .escolha, #tela-inicio .intro, #tela-inicio .rodape')) {
    el.hidden = ligada;
  }
  if (ligada) {
    $('#codigo').value = '';
    $('#codigo-msg').innerHTML = '';
    $('#codigo').focus();
  }
}

async function pedirSupervisora() {
  if (await db.ler('supervisoraLiberada')) { await entrarComo('supervisora'); return; }
  mostrarTrava(true);
}

async function conferirCodigo() {
  const digitado = $('#codigo').value.trim();
  if (!digitado) return;

  if (!temCripto()) {
    $('#codigo-msg').innerHTML =
      '<div class="msg erro">Abra o app pelo endereço https para conferir o código.</div>';
    return;
  }

  /* a conferência é lenta de propósito (PBKDF2) — avisa que
     está trabalhando para não parecer travado                 */
  const botao = $('#btn-entrar-supervisora');
  botao.disabled = true;
  botao.textContent = 'Conferindo…';
  const certo = await confere(digitado);
  botao.disabled = false;
  botao.textContent = 'Entrar';

  if (!certo) {
    $('#codigo-msg').innerHTML = '<div class="msg erro">Código errado.</div>';
    $('#codigo').value = '';
    $('#codigo').focus();
    return;
  }
  /* liberado uma vez, fica liberado neste aparelho — ela não vai
     digitar código toda vez que abrir                           */
  await db.guardar('supervisoraLiberada', true);
  mostrarTrava(false);
  await entrarComo('supervisora');
}

/* ---------- perfis ---------- */
async function entrarComo(perfil, guardando = true) {
  if (guardando) await db.guardar('perfil', perfil);
  $('#btn-trocar-perfil').hidden = false;

  if (perfil === 'operador') {
    if (!operadorPronto) {
      await iniciarOperador((partes, pendentes) => {
        abrirEntrega(partes, pendentes);
        mostrarTela('#tela-entrega');
      });
      ligarEntrega({
        aoVoltar: () => mostrarTela('#tela-operador'),
        aoConcluir: async () => { await recarregarLista(); mostrarTela('#tela-operador'); },
      });
      operadorPronto = true;
    }
    mostrarTela('#tela-operador');
  } else {
    if (!supervisoraPronta) { await iniciarSupervisora(); supervisoraPronta = true; }
    mostrarTela('#tela-supervisora');
  }
}

async function iniciar() {
  for (const b of document.querySelectorAll('[data-perfil]')) {
    b.addEventListener('click', () => {
      if (b.dataset.perfil === 'supervisora') pedirSupervisora();
      else entrarComo('operador');
    });
  }

  $('#btn-entrar-supervisora').addEventListener('click', conferirCodigo);
  $('#codigo').addEventListener('keydown', (ev) => {
    if (ev.key === 'Enter') { ev.preventDefault(); conferirCodigo(); }
  });
  $('#btn-cancelar-codigo').addEventListener('click', () => mostrarTrava(false));

  $('#btn-trocar-perfil').addEventListener('click', async () => {
    pararTudo();
    await db.guardar('perfil', null);
    $('#btn-trocar-perfil').hidden = true;
    mostrarTrava(false);
    mostrarTela('#tela-inicio');
  });

  const perfil = await db.ler('perfil');
  const liberada = await db.ler('supervisoraLiberada');
  if (perfil === 'operador') await entrarComo('operador', false);
  else if (perfil === 'supervisora' && liberada) await entrarComo('supervisora', false);
  else mostrarTela('#tela-inicio');

  if ('serviceWorker' in navigator) {
    /* falha aqui não pode derrubar o app: sem service worker
       ele ainda funciona, só não abre offline               */
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
}

iniciar();
