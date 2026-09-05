/* ============================================================
   Tela de entrega do operador.
   Três caminhos, de propósito — nenhum deles pode ser ponto
   único de falha, porque cada um falha por um motivo diferente:
     - Enviar: precisa de internet uma vez (em casa serve)
     - QR: precisa dela por perto
     - Texto: precisa só de um jeito de mandar recado
   ============================================================ */
import * as db from './db.js';
import { nomeMaquina } from './planilha.js';

const $ = (s) => document.querySelector(s);
const brData = (iso) => (iso || '').split('-').reverse().join('/');

let partes = [];
let pendentes = [];
let atual = 0;
let voltar = null;
let concluir = null;

/* ---------- QR ---------- */
function desenharQr() {
  const palco = $('#qr-palco');
  const legenda = $('#qr-legenda');
  if (!partes.length) { palco.innerHTML = ''; legenda.textContent = ''; return; }

  /* correção de erro "M": aguenta reflexo e tela suja sem
     inflar demais a quantidade de módulos                    */
  const qr = window.qrcode(0, 'M');
  qr.addData(partes[atual], 'Byte');
  qr.make();
  palco.innerHTML = qr.createSvgTag({ cellSize: 8, margin: 2, scalable: true });

  legenda.innerHTML = `Parte ${atual + 1} de ${partes.length}` +
    (partes.length > 1
      ? '<span class="restante">Passe todas antes de sair desta tela.</span>'
      : '');

  $('#qr-anterior').disabled = atual === 0;
  $('#qr-proximo').disabled = atual === partes.length - 1;
  $('#qr-anterior').hidden = partes.length === 1;
  $('#qr-proximo').hidden = partes.length === 1;
}

/* ---------- texto / arquivo ---------- */
function resumoHumano() {
  const datas = pendentes.map((r) => r.data).sort();
  const quem = [...new Set(pendentes.map((r) => r.operador))].join(', ');
  const maquinas = [...new Set(pendentes.map((r) => nomeMaquina(r.maquina)))].join(', ');
  return `Controle de Operação — ${quem}\n`
    + `${pendentes.length} registro(s) de ${brData(datas[0])} a ${brData(datas[datas.length - 1])}\n`
    + `Máquina(s): ${maquinas}\n`
    + 'Não apague nem edite o texto abaixo — é ele que vira a planilha.\n\n';
}

const corpoTexto = () => resumoHumano() + partes.join('\n');

const nomeArquivo = () => {
  const quem = (pendentes[0] && pendentes[0].operador || 'operador')
    .toLowerCase().normalize('NFD').replace(/[^a-z]/g, '');
  return `controle-${quem}-${new Date().toISOString().slice(0, 10)}.txt`;
};

function aviso(tipo, texto) {
  $('#entrega-msg').innerHTML = `<div class="msg ${tipo}">${texto}</div>`;
}

async function compartilhar() {
  const texto = corpoTexto();
  const arquivo = new File([texto], nomeArquivo(), { type: 'text/plain' });

  try {
    if (navigator.canShare && navigator.canShare({ files: [arquivo] })) {
      await navigator.share({ files: [arquivo], title: 'Controle de Operação' });
    } else if (navigator.share) {
      await navigator.share({ text: texto, title: 'Controle de Operação' });
    } else {
      await navigator.clipboard.writeText(texto);
      aviso('ok', 'Este aparelho não tem o botão de compartilhar. '
        + 'O texto foi copiado — cole no WhatsApp dela.');
      return;
    }
    aviso('ok', 'Enviado. Confirme com ela que chegou antes de marcar como entregue.');
  } catch (e) {
    if (e && e.name === 'AbortError') return;      // usuário desistiu, não é erro
    aviso('aviso', 'Não deu para enviar por aqui. Use "Salvar como arquivo" '
      + 'ou copie o texto logo abaixo.');
  }
}

function baixarArquivo() {
  const url = URL.createObjectURL(new Blob([corpoTexto()], { type: 'text/plain' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = nomeArquivo();
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  aviso('ok', 'Arquivo salvo nos downloads. Mande por WhatsApp, e-mail ou cabo.');
}

async function copiar() {
  try {
    await navigator.clipboard.writeText(corpoTexto());
    $('#btn-copiar').textContent = 'Copiado!';
    setTimeout(() => { $('#btn-copiar').textContent = 'Copiar'; }, 2500);
  } catch {
    $('#texto-entrega').select();
    aviso('aviso', 'Selecione o texto e copie na mão.');
  }
}

/* ---------- abas ---------- */
function trocarAba(qual) {
  for (const b of document.querySelectorAll('[data-entrega]')) {
    b.classList.toggle('ativa', b.dataset.entrega === qual);
  }
  $('#entrega-enviar').hidden = qual !== 'enviar';
  $('#entrega-qr').hidden = qual !== 'qr';
  if (qual === 'qr') desenharQr();
}

/* ---------- entrada ---------- */
export function ligarEntrega({ aoVoltar, aoConcluir }) {
  voltar = aoVoltar;
  concluir = aoConcluir;

  $('#qr-anterior').addEventListener('click', () => { if (atual > 0) { atual--; desenharQr(); } });
  $('#qr-proximo').addEventListener('click', () => { if (atual < partes.length - 1) { atual++; desenharQr(); } });

  for (const b of document.querySelectorAll('[data-entrega]')) {
    b.addEventListener('click', () => trocarAba(b.dataset.entrega));
  }

  $('#btn-compartilhar').addEventListener('click', compartilhar);
  $('#btn-baixar-arquivo').addEventListener('click', baixarArquivo);
  $('#btn-copiar').addEventListener('click', copiar);
  $('#btn-voltar-operador').addEventListener('click', () => voltar());

  $('#btn-marcar-entregue').addEventListener('click', async () => {
    if (!confirm(`Marcar ${pendentes.length} registro(s) como entregues?\n\n`
      + 'Só confirme depois que ela disser que recebeu. '
      + 'Nada será apagado — dá para mandar de novo se precisar.')) return;
    for (const r of pendentes) await db.salvarRegistro({ ...r, entregue: true });
    await concluir();
  });
}

export function abrirEntrega(chunks, registros) {
  partes = chunks;
  pendentes = registros;
  atual = 0;
  $('#entrega-msg').innerHTML = '';
  $('#texto-entrega').value = corpoTexto();
  $('#btn-marcar-entregue').textContent =
    `Pronto, já entreguei ${pendentes.length} registro${pendentes.length === 1 ? '' : 's'}`;
  trocarAba('enviar');
}
