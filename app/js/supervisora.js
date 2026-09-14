/* ============================================================
   Tela da supervisora: recolher e conferir.
   Recolhe por três vias (câmera, foto, texto) porque cada uma
   cobre um jeito diferente do dia dar errado.
   Repetição nunca duplica: cada registro tem id próprio.
   ============================================================ */
import * as db from './db.js';
import { Montador } from './pack.js';
import { COLUNAS, paraPlanilha, paraCsv, horasDe, nomeMaquina, brHorimetro } from './planilha.js';
import { gerarXlsx } from './xlsxgen.js';
import { analisarCadeia } from './validacao.js';
import { esc } from './texto.js';

const $ = (s) => document.querySelector(s);
const brData = (iso) => (iso || '').split('-').reverse().join('/');
const brNum = (n) => String(n).replace('.', ',');

const montador = new Montador();
let fluxoCamera = null;
let rodando = false;
let ultimoTexto = '';
let idsExportados = [];

/* ---------- retorno visual ---------- */
function progresso(estado) {
  const alvo = $('#progresso-scan');
  if (!estado) { alvo.hidden = true; return; }
  alvo.hidden = false;
  alvo.innerHTML = estado;
}

function recibo(tipo, titulo, itens) {
  const alvo = $('#recibo');
  alvo.hidden = false;
  alvo.innerHTML = `<div class="msg ${esc(tipo)}"><strong>${esc(titulo)}</strong>`
    + itens.map((t) => `<div>${esc(t)}</div>`).join('') + '</div>';
}

const vibrar = (padrao) => { try { navigator.vibrate && navigator.vibrate(padrao); } catch {} };

/* ---------- consumo de um QR/texto ---------- */
async function consumir(texto) {
  if (!texto || texto === ultimoTexto) return false;

  const r = montador.receber(texto);
  if (!r.ok) return false;
  ultimoTexto = texto;

  if (r.estado === 'parcial') {
    vibrar(60);
    const f = r.faltando;
    progresso(`Lidas ${r.lidas} de ${r.total} partes.<br>`
      + (f.length === 1 ? `Falta a parte ${f[0]}` : `Faltam as partes ${f.join(', ')}`)
      + ' — peça para passar.');
    return true;
  }

  const { novos, repetidos } = await db.salvarVarios(r.registros);
  vibrar([60, 50, 120]);
  progresso(null);
  ultimoTexto = '';

  const itens = [`${novos} registro(s) novo(s) guardado(s).`];
  if (repetidos) itens.push(`${repetidos} já estavam aqui e foram ignorados.`);
  const quem = [...new Set(r.registros.map((x) => x.operador))].join(', ');
  if (quem) itens.push(`De: ${quem}.`);
  recibo('ok', 'Conjunto completo recebido.', itens);

  await pintarConferencia();
  return true;
}

/* ---------- câmera ---------- */
async function abrirCamera() {
  const video = $('#camera');
  try {
    fluxoCamera = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'environment', width: { ideal: 1280 } },
    });
  } catch {
    recibo('erro', 'Não consegui abrir a câmera.', [
      'Verifique se você permitiu o acesso, ou use "Ler QR de uma foto".',
    ]);
    return;
  }
  video.srcObject = fluxoCamera;
  await video.play();
  $('#area-camera').hidden = false;
  $('#btn-abrir-camera').hidden = true;
  rodando = true;
  laco();
}

function pararCamera() {
  rodando = false;
  if (fluxoCamera) fluxoCamera.getTracks().forEach((t) => t.stop());
  fluxoCamera = null;
  $('#camera').srcObject = null;
  $('#area-camera').hidden = true;
  $('#btn-abrir-camera').hidden = false;
}

const tela = document.createElement('canvas');
const pincel = tela.getContext('2d', { willReadFrequently: true });

function laco() {
  if (!rodando) return;
  const video = $('#camera');
  if (video.readyState === video.HAVE_ENOUGH_DATA) {
    const escala = Math.min(1, 640 / video.videoWidth);
    tela.width = Math.round(video.videoWidth * escala);
    tela.height = Math.round(video.videoHeight * escala);
    pincel.drawImage(video, 0, 0, tela.width, tela.height);
    const img = pincel.getImageData(0, 0, tela.width, tela.height);
    const achado = window.jsQR(img.data, img.width, img.height, { inversionAttempts: 'dontInvert' });
    if (achado && achado.data) consumir(achado.data);
  }
  requestAnimationFrame(laco);
}

/* ---------- foto ---------- */
async function lerFotos(arquivos) {
  let encontrados = 0;
  for (const arquivo of arquivos) {
    try {
      const bitmap = await createImageBitmap(arquivo);
      /* fotos de tela costumam vir grandes; reduzir ajuda o jsQR */
      const escala = Math.min(1, 1400 / Math.max(bitmap.width, bitmap.height));
      tela.width = Math.round(bitmap.width * escala);
      tela.height = Math.round(bitmap.height * escala);
      pincel.drawImage(bitmap, 0, 0, tela.width, tela.height);
      const img = pincel.getImageData(0, 0, tela.width, tela.height);
      const achado = window.jsQR(img.data, img.width, img.height);
      if (achado && achado.data) {
        ultimoTexto = '';
        if (await consumir(achado.data)) encontrados++;
      }
    } catch { /* arquivo que não é imagem: ignora */ }
  }
  if (!encontrados) {
    recibo('aviso', 'Nenhum QR reconhecido nessas fotos.', [
      'Peça uma foto mais próxima, com o QR inteiro e sem reflexo.',
      'Se preferir, peça o texto e cole no campo abaixo.',
    ]);
  }
}

/* ---------- texto colado ---------- */
async function lerTextoColado() {
  const bruto = $('#texto-colado').value;
  const linhas = bruto.split(/\s+/).filter((l) => /^S[12]\|/.test(l));
  if (!linhas.length) {
    recibo('aviso', 'Não achei dados nesse texto.', [
      'Copie a mensagem inteira que o operador mandou, sem cortar nada.',
    ]);
    return;
  }
  ultimoTexto = '';
  for (const l of linhas) { await consumir(l); ultimoTexto = ''; }
  $('#texto-colado').value = '';
}

/* ---------- conferência ---------- */
async function pintarConferencia() {
  const registros = await db.listarRegistros();
  const linhas = paraPlanilha(registros);
  const problemas = analisarCadeia(registros);

  const resumo = $('#resumo');
  if (!registros.length) {
    resumo.innerHTML = '<p class="vazio">Nada recolhido ainda.</p>';
    $('#problemas').innerHTML = '';
    $('#tabela').innerHTML = '';
    return;
  }

  const datas = registros.map((r) => r.data).sort();
  const horas = registros.reduce((s, r) => s + horasDe(r), 0);
  resumo.innerHTML = '<dl>'
    + `<dt>Registros</dt><dd>${registros.length}</dd>`
    + `<dt>Período</dt><dd>${brData(datas[0])} a ${brData(datas[datas.length - 1])}</dd>`
    + `<dt>Operadores</dt><dd>${new Set(registros.map((r) => r.operador)).size}</dd>`
    + `<dt>Máquinas</dt><dd>${new Set(registros.map((r) => r.maquina)).size}</dd>`
    + `<dt>Total de horas</dt><dd>${brNum(Math.round(horas * 10) / 10)} h</dd>`
    + '</dl>';

  $('#problemas').innerHTML = problemas.length
    ? `<div class="msg ${problemas.some((p) => p.tipo === 'erro') ? 'erro' : 'aviso'}">`
      + `<strong>${problemas.length} ponto(s) para conferir antes de exportar:</strong>`
      + problemas.map((p) => `<div>${esc(p.texto)}</div>`).join('') + '</div>'
    : '<div class="msg ok"><strong>Nenhuma inconsistência encontrada.</strong>'
      + '<div>Horímetros encadeados, sem buraco nem sobreposição.</div></div>';

  const suspeitos = new Map(problemas.map((p) => [p.id, p.tipo]));
  const cabecalho = '<tr>' + COLUNAS.map((c) => `<th>${c.titulo}</th>`).join('') + '</tr>';
  const corpo = registros
    .slice()
    .sort((a, b) => a.data.localeCompare(b.data) || a.hIni - b.hIni)
    .map((r) => {
      const marca = suspeitos.get(r.id);
      const classe = marca === 'erro' ? ' class="invalida"' : marca ? ' class="suspeita"' : '';
      return `<tr${classe}>`
        + `<td>${brData(r.data)}</td><td>${esc(r.operador)}</td><td>${esc(nomeMaquina(r.maquina))}</td>`
        + `<td>${brHorimetro(r.hIni)}</td><td>${brHorimetro(r.hFim)}</td><td>${brNum(horasDe(r))}</td>`
        + `<td>${esc(r.local)}</td><td>${esc(r.atividade)}</td><td>${esc(r.vala)}</td><td>${esc(r.obs)}</td>`
        + '</tr>';
    }).join('');
  $('#tabela').innerHTML = cabecalho + corpo;

  idsExportados = registros.map((r) => r.id);
  return linhas;
}

/* ---------- exportação ---------- */
async function entregarArquivo(bytes, tipo, nome) {
  const blob = new Blob([bytes], { type: tipo });
  const arquivo = new File([blob], nome, { type: tipo });
  if (navigator.canShare && navigator.canShare({ files: [arquivo] })) {
    try { await navigator.share({ files: [arquivo], title: nome }); return; }
    catch (e) { if (e && e.name === 'AbortError') return; }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = nome; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

const nomeSaida = (ext) => `controle-operacao-${new Date().toISOString().slice(0, 10)}.${ext}`;

async function exportarXlsx() {
  const registros = await db.listarRegistros();
  if (!registros.length) return;
  const bytes = gerarXlsx(COLUNAS, paraPlanilha(registros), 'Controle');
  await entregarArquivo(bytes,
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', nomeSaida('xlsx'));
}

async function exportarCsv() {
  const registros = await db.listarRegistros();
  if (!registros.length) return;
  await entregarArquivo(paraCsv(registros), 'text/csv;charset=utf-8', nomeSaida('csv'));
}

async function limpar() {
  const quantos = idsExportados.length;
  if (!quantos) return;
  if (!confirm(`Apagar ${quantos} registro(s) deste aparelho?\n\n`
    + 'Faça isso só depois de conferir que o Excel foi salvo no lugar certo. '
    + 'Não tem como desfazer.')) return;
  for (const id of idsExportados) await db.apagarRegistro(id);
  idsExportados = [];
  await pintarConferencia();
  recibo('ok', 'Limpo.', ['O aparelho está pronto para a próxima coleta.']);
}

/* ---------- abas ---------- */
function trocarAba(qual) {
  for (const b of document.querySelectorAll('[data-aba]')) {
    b.classList.toggle('ativa', b.dataset.aba === qual);
  }
  $('#painel-recolher').hidden = qual !== 'recolher';
  $('#painel-conferir').hidden = qual !== 'conferir';
  if (qual === 'conferir') { pararCamera(); pintarConferencia(); }
}

/* ---------- entrada ---------- */
export async function iniciarSupervisora() {
  $('#btn-abrir-camera').addEventListener('click', abrirCamera);
  $('#btn-parar-camera').addEventListener('click', pararCamera);
  $('#entrada-foto').addEventListener('change', (ev) => {
    lerFotos([...ev.target.files]);
    ev.target.value = '';
  });
  $('#btn-ler-texto').addEventListener('click', lerTextoColado);
  $('#btn-xlsx').addEventListener('click', exportarXlsx);
  $('#btn-csv').addEventListener('click', exportarCsv);
  $('#btn-limpar').addEventListener('click', limpar);

  for (const b of document.querySelectorAll('[data-aba]')) {
    b.addEventListener('click', () => trocarAba(b.dataset.aba));
  }

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) pararCamera();
  });

  await pintarConferencia();
}

export const pararTudo = pararCamera;
