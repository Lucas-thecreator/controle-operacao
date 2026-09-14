/* Testes das duas peças de risco:
   1) o .xlsx escrito na mão abre mesmo? (lido de volta pela SheetJS)
   2) o que entra no QR volta idêntico do outro lado?
   Rodar com: npm test                                          */
import fs from 'node:fs';
import path from 'node:path';
import XLSX from 'xlsx';
import { gerarXlsx } from '../app/js/xlsxgen.js';
import { COLUNAS, paraPlanilha, paraCsv } from '../app/js/planilha.js';
import { empacotar, Montador } from '../app/js/pack.js';
import { acharVizinhos, validar } from '../app/js/validacao.js';

let falhas = 0;
const ok = (cond, msg) => {
  console.log((cond ? '  OK   ' : '  FALHA') + '  ' + msg);
  if (!cond) falhas++;
};

/* Linhas reais tiradas da planilha e do caderno dela ---------- */
const AMOSTRA = [
  { id: 'a00001', data: '2026-07-14', operador: 'Gustavo', maquina: 'TEA279', hIni: 3001.4, hFim: 3002.8, local: 'Classe II', vala: '',  atividade: 'Rampa',                   obs: '' },
  { id: 'a00002', data: '2026-07-14', operador: 'Gustavo', maquina: 'TEA279', hIni: 3002.8, hFim: 3003.4, local: 'Classe I',  vala: '',  atividade: 'Compactação de resíduos', obs: '' },
  { id: 'a00003', data: '2026-07-14', operador: 'Glauber', maquina: 'TEA279', hIni: 3003.4, hFim: 3004.1, local: 'Classe I',  vala: '',  atividade: 'Compactação de resíduos', obs: '' },
  { id: 'a00004', data: '2026-07-17', operador: 'Gustavo', maquina: 'TEA279', hIni: 3021.7, hFim: 3027,   local: 'Classe I',  vala: '',  atividade: 'Compactação de resíduos', obs: '' },
  { id: 'a00005', data: '2026-08-19', operador: 'Gustavo', maquina: 'TEA279', hIni: 3142.1, hFim: 3142.4, local: 'Classe I',  vala: '8', atividade: 'Empurrar material',       obs: '' },
  { id: 'a00006', data: '2026-08-18', operador: 'Armando', maquina: 'TEA279', hIni: 3132.7, hFim: 3139.1, local: 'Classe II A', vala: '', atividade: 'Cobertura de manta',     obs: 'letra do caderno estava dupla' },
  /* casos-limite: acento, "Outro" fora da lista, vírgula e til no texto livre */
  { id: 'a00007', data: '2026-09-04', operador: 'Reinaldo', maquina: 'TP52', hIni: 12.5, hFim: 14, local: 'Pátio norte, entrada', vala: '10', atividade: 'Manutenção ~ preventiva', obs: 'aspas " e ; ponto-e-vírgula' },
];

console.log('\n=== 1. Geração de .xlsx ===');
const linhas = paraPlanilha(AMOSTRA);
const bytes = gerarXlsx(COLUNAS, linhas, 'Controle');
const destino = path.join(process.cwd(), 'tools', 'saida-teste.xlsx');
fs.writeFileSync(destino, bytes);
ok(bytes.length > 0, `arquivo gerado (${bytes.length} bytes)`);

const livro = XLSX.read(fs.readFileSync(destino), { type: 'buffer', cellDates: true });
const aba = livro.Sheets[livro.SheetNames[0]];
const lido = XLSX.utils.sheet_to_json(aba, { raw: false, dateNF: 'yyyy-mm-dd' });

ok(livro.SheetNames[0] === 'Controle', 'aba chamada "Controle"');
ok(lido.length === AMOSTRA.length, `${lido.length} linhas lidas de volta (esperado ${AMOSTRA.length})`);

const cabecalhos = XLSX.utils.sheet_to_json(aba, { header: 1 })[0];
const esperados = COLUNAS.map((c) => c.titulo);
ok(JSON.stringify(cabecalhos) === JSON.stringify(esperados),
  'cabeçalho bate coluna a coluna com a planilha dela');
if (cabecalhos.join('|') !== esperados.join('|')) {
  console.log('     gerado:  ' + cabecalhos.join(' | '));
  console.log('     esperado:' + esperados.join(' | '));
}

const primeira = lido.find((l) => l.Operador === 'Gustavo' && l['H inicial'] === '3001.4');
ok(!!primeira, 'linha do Gustavo de 14/07 encontrada');
ok(primeira && primeira['Horas trabalhada'] === '1.4', `horas calculadas = 1,4 (veio "${primeira && primeira['Horas trabalhada']}")`);
ok(primeira && primeira['Máquina'] === 'TEA 279 (Locado)', 'rótulo da máquina igual ao da planilha dela');

const comAcento = lido.find((l) => l.Operador === 'Reinaldo');
ok(comAcento && comAcento['Tipo de serviço'] === 'Manutenção ~ preventiva', 'acentos e til sobrevivem ao Excel');
ok(comAcento && comAcento['Observação'] === 'aspas " e ; ponto-e-vírgula', 'aspas e ponto-e-vírgula sobrevivem');

/* lê de novo sem cellDates para ver a célula como o Excel a guarda */
const cru = XLSX.read(fs.readFileSync(destino), { type: 'buffer' });
const dataCrua = cru.Sheets[cru.SheetNames[0]]['A2'];
ok(dataCrua && dataCrua.t === 'n' && dataCrua.w === '14/07/2026',
  `Data é data de verdade, não texto — filtro e ordenação do Excel funcionam (serial ${dataCrua && dataCrua.v}, exibida "${dataCrua && dataCrua.w}")`);

console.log('\n=== 2. Ida e volta pelo QR ===');
const qrs = empacotar(AMOSTRA);
ok(qrs.length >= 1, `${qrs.length} QR(s) gerado(s) para ${AMOSTRA.length} registros`);
qrs.forEach((q, i) => console.log(`     QR ${i + 1}: ${q.length} bytes`));
ok(qrs.every((q) => q.length <= 460), 'todos os QRs dentro do limite de densidade');

const montador = new Montador();
let resultado = null;
for (const q of qrs) resultado = montador.receber(q);
ok(resultado && resultado.estado === 'completo', 'conjunto fechou depois de ler todas as partes');

const voltou = resultado.registros;
ok(voltou.length === AMOSTRA.length, `${voltou.length} registros reconstruídos`);

let iguais = 0;
for (const original of AMOSTRA) {
  const r = voltou.find((x) => x.id === original.id);
  if (!r) { console.log(`     PERDIDO: ${original.id}`); continue; }
  const campos = ['data', 'operador', 'maquina', 'hIni', 'hFim', 'local', 'vala', 'atividade', 'obs'];
  const difs = campos.filter((c) => String(r[c]) !== String(original[c]));
  if (difs.length) console.log(`     DIFERENÇA em ${original.id}: ${difs.map((d) => `${d}: "${original[d]}" -> "${r[d]}"`).join(', ')}`);
  else iguais++;
}
ok(iguais === AMOSTRA.length, `${iguais}/${AMOSTRA.length} registros voltaram idênticos`);

console.log('\n=== 3. Leitura fora de ordem e QR repetido ===');
const m2 = new Montador();
const embaralhado = [...qrs].reverse();
let r2 = null;
for (const q of embaralhado) r2 = m2.receber(q);
ok(r2 && r2.estado === 'completo', 'monta mesmo lendo as partes de trás para frente');

const m3 = new Montador();
let r3 = m3.receber(qrs[0]);
if (qrs.length > 1) {
  r3 = m3.receber(qrs[0]);   // mesma parte de novo
  ok(r3.estado === 'parcial' && r3.repetida === true, 'QR repetido é reconhecido, não duplica');
  for (let i = 1; i < qrs.length; i++) r3 = m3.receber(qrs[i]);
  ok(r3.estado === 'completo', 'fecha normalmente depois da repetição');
} else {
  ok(r3.estado === 'completo', 'conjunto de uma parte só fecha na primeira leitura');
}

ok(m3.receber('qualquer coisa aleatoria').estado === 'nao-e-nosso', 'QR de terceiro é rejeitado');

console.log('\n=== 4. CSV de reserva ===');
const csv = paraCsv(AMOSTRA);
ok(csv.charCodeAt(0) === 0xFEFF, 'CSV começa com BOM (Excel abre com acento certo)');
ok(csv.replace(/^﻿/, '').split('\r\n')[0].startsWith('Data;Operador;Máquina'),
  'CSV separado por ponto-e-vírgula');
ok(csv.includes('14/07/2026'), 'data em formato brasileiro no CSV');
ok(csv.includes('1,4'), 'número com vírgula decimal no CSV');

console.log('\n=== 4b. Texto hostil não vira código ===');
/* Dois caminhos de execução, um em cada formato de saída:
   HTML na tela dela, e fórmula do Excel na planilha.          */
const HOSTIL = [{
  id: 'mal01', data: '2026-09-05', maquina: 'TEA279', hIni: 100, hFim: 102,
  operador: '=1+1', local: '<img src=x onerror="alert(1)">',
  atividade: '@SUM(A1:A9)', vala: '', obs: '+cmd|calc',
}];

const csvHostil = paraCsv(HOSTIL);
const celulas = csvHostil.split('\r\n')[1].split(';');
ok(celulas.every((c) => !/^[=+\-@]/.test(c.replace(/^"/, ''))),
  'CSV: nenhuma célula começa com = + - @ (Excel não roda fórmula)');
ok(csvHostil.includes("'=1+1"), 'CSV: o valor original continua legível, só desarmado');

const bytesHostis = gerarXlsx(COLUNAS, paraPlanilha(HOSTIL), 'Controle');
const arqHostil = path.join(process.cwd(), 'tools', 'saida-hostil.xlsx');
fs.writeFileSync(arqHostil, bytesHostis);
const livroHostil = XLSX.read(fs.readFileSync(arqHostil), { type: 'buffer' });
const abaHostil = livroHostil.Sheets[livroHostil.SheetNames[0]];
ok(abaHostil.B2 && abaHostil.B2.t === 's' && !abaHostil.B2.f,
  'xlsx: "=1+1" entra como texto, sem fórmula anexada');
ok(abaHostil.B2 && abaHostil.B2.v === '=1+1', 'xlsx: valor preservado exatamente');
fs.unlinkSync(arqHostil);

/* o escape de HTML é do lado da tela — aqui só a garantia de que
   o dado atravessa o QR sem ser alterado, para o escape decidir */
const idaEVolta = new Montador().receber(empacotar(HOSTIL)[0]);
ok(idaEVolta.registros[0].local === '<img src=x onerror="alert(1)">',
  'QR: texto hostil chega intacto do outro lado (quem protege é o escape na tela)');

console.log('\n=== 5. Lançamento retroativo ===');
/* Bug encontrado em uso: lançar um registro de ontem puxava o
   horímetro final de HOJE. A posição na cadeia tem de sair da
   data do formulário, não da ordem em que se digitou.         */
const reg = (id, data, hIni, hFim, operador = 'Gustavo') =>
  ({ id, data, operador, maquina: 'TEA279', hIni, hFim,
     local: 'Classe I', vala: '', atividade: 'Compactação de resíduos', obs: '' });

const jaLancado = [reg('h1', '2026-09-05', 3150, 3152)];

const ontem = acharVizinhos(jaLancado, 'TEA279', '2026-09-04');
ok(ontem.anterior === null,
  'lançando ONTEM, não trata o registro de hoje como anterior');
ok(ontem.posterior && ontem.posterior.id === 'h1',
  'lançando ONTEM, enxerga o registro de hoje como o seguinte');

const maisTarde = acharVizinhos(jaLancado, 'TEA279', '2026-09-05');
ok(maisTarde.anterior && maisTarde.anterior.hFim === 3152,
  'lançando HOJE de novo, o anterior é o registro de hoje (3152,0)');

/* com registro dos dois lados, o retroativo tem de se encaixar no meio */
const cercado = [reg('h0', '2026-09-03', 3145, 3150), reg('h1', '2026-09-05', 3150, 3152)];
const meio = acharVizinhos(cercado, 'TEA279', '2026-09-04');
ok(meio.anterior && meio.anterior.id === 'h0', 'retroativo pega o anterior certo (03/09)');
ok(meio.posterior && meio.posterior.id === 'h1', 'retroativo pega o posterior certo (05/09)');

const invasor = { ...reg('novo', '2026-09-04', 3150, 3153), criadoEm: '', entregue: false };
const vInvasor = validar(invasor, meio);
ok(vInvasor.erros.length === 0, 'invadir o registro seguinte não é erro (não trava)');
ok(vInvasor.avisos.some((a) => a.includes('por cima') && a.includes('05/09/2026')),
  'mas avisa que passa por cima do registro de 05/09');
ok(vInvasor.avisos.every((a) => a.length <= 90),
  'e o aviso cabe numa olhada — nada acima de 90 caracteres');

/* a tela do operador não pode virar parede de texto */
const prolixos = [
  validar({ ...reg('a', '2026-09-04', 3200, 3199) }, meio),
  validar({ ...reg('b', '2026-09-04', 3150, 3190) }, meio),
  validar({ ...reg('c', '2026-01-01', 3150, 3151) }, { anterior: null, posterior: null }),
].flatMap((v) => [...v.erros, ...v.avisos]);
const maiorMensagem = Math.max(...prolixos.map((m) => m.length));
ok(maiorMensagem <= 90, `nenhuma mensagem do operador passa de 90 caracteres (maior: ${maiorMensagem})`);

const encaixado = { ...reg('novo', '2026-09-04', 3150, 3150), criadoEm: '', entregue: false };
const vEncaixado = validar(encaixado, meio);
ok(!vEncaixado.avisos.some((a) => a.includes('passa por cima')),
  'encaixando certinho entre os dois, não reclama de sobreposição');
ok(!vEncaixado.avisos.some((a) => a.includes('sobraram') || a.includes('faltam')),
  'e não acusa salto falso de horímetro');

/* máquina diferente não pode interferir */
const outraMaquina = acharVizinhos(
  [...cercado, { ...reg('x', '2026-09-04', 9000, 9100), maquina: 'TP52' }],
  'TEA279', '2026-09-04');
ok(outraMaquina.anterior && outraMaquina.anterior.id === 'h0',
  'registro de outra máquina não entra na cadeia');

console.log('\n=== 6. Listas de local e serviço ===');
const cfg = await import('../app/js/config.js');

ok(cfg.LOCAIS.length === 13, `13 locais (veio ${cfg.LOCAIS.length})`);
ok([cfg.LOCAIS, ...Object.values(cfg.ATIVIDADES_POR_MAQUINA)].flat()
  .every((t) => t.length > 0 && t === t.trim()),
  'nenhum item com espaço sobrando nas pontas (a planilha dela tinha vários)');
ok(Object.values(cfg.ATIVIDADES_POR_MAQUINA).every((l) => new Set(l).size === l.length),
  'nenhuma máquina com serviço repetido');
ok(Object.keys(cfg.ATIVIDADES_POR_MAQUINA).every((id) => cfg.MAQUINAS.some((m) => m.id === id)),
  'toda lista de serviço aponta para uma máquina que existe');
ok(cfg.MAQUINAS.every((m) => cfg.atividadesDa(m.id).length > 0),
  'toda máquina tem ao menos um serviço para escolher');
ok(cfg.atividadesDa('TP52').includes('Sucção de lodo') && !cfg.atividadesDa('TP52').includes('Pátio'),
  'TP 52 mostra só o que ela faz');
ok(cfg.atividadesDa('TEA279') === cfg.atividadesDa('TEA340'), 'TEA 279 e TEA 340 dividem a lista');
ok(cfg.atividadesDa('TP44').includes('Sucção de lodo') && cfg.atividadesDa('TP44').includes('Pátio'),
  'TP 44, sem lista própria, mostra todas');

console.log('\n=== 7. QR não depende da versão da lista ===');
/* O S1 mandava "serviço nº 3". Celular com lista velha e
   supervisora com lista nova trocariam o serviço sem erro
   nenhum. O S2 leva o texto dentro do próprio QR.             */
const lerTudo = (partes) => {
  const m = new Montador();
  let r = null;
  for (const p of partes) r = m.receber(p);
  return r;
};

/* QR S1 de verdade, tirado do app antes desta mudança */
const s1 = 'S1|1|1|9nowp|pq91k0h3,260905,3,6,3001.4,3002.8,0,,0,'
  + '~abc123,260906,*Ronaldo,10,12.5,14,2,3,5,teste';
const v1 = lerTudo([s1]);
ok(v1.estado === 'completo' && v1.registros.length === 2,
  'QR antigo (S1), de celular ainda não atualizado, continua sendo lido');
const [a1, b1] = v1.registros;
ok(a1.operador === 'Gustavo' && a1.maquina === 'TEA279' && a1.local === 'Classe I'
  && a1.atividade === 'Compactação de resíduos',
  'S1 é lido pelas listas da época, não pelas de hoje');
ok(b1.operador === 'Ronaldo' && b1.maquina === 'TP52' && b1.local === 'Classe II A'
  && b1.vala === '3' && b1.atividade === 'Pátio' && b1.obs === 'teste',
  'S1 com texto livre misturado a índices');

const foraDaLista = [
  reg('n1', '2026-09-10', 3200, 3202),
  { ...reg('n2', '2026-09-10', 3202, 3205), local: 'Balança', atividade: 'Serviço que não existe em lista nenhuma' },
];
const pS2 = empacotar(foraDaLista);
ok(pS2.every((p) => p.startsWith('S2|')), 'o app agora gera S2');
const v2 = lerTudo(pS2);
ok(v2.estado === 'completo' && v2.registros[1].atividade === 'Serviço que não existe em lista nenhuma',
  'S2 leva o texto: não precisa que a lista do outro aparelho seja igual');

const semana = Array.from({ length: 60 }, (_, i) => ({
  ...reg('w' + String(i).padStart(6, '0'), '2026-09-0' + (1 + (i % 5)),
    3100 + i * 2, 3101.5 + i * 2, i % 3 ? 'Gustavo' : 'Armando'),
  local: cfg.LOCAIS[i % 4],
  atividade: cfg.atividadesDa('TEA279')[i % 5],
  vala: i % 4 ? '' : '8',
}));
const partesSemana = empacotar(semana);
const voltaSemana = lerTudo([...partesSemana].reverse());
const campos = ['data', 'operador', 'maquina', 'hIni', 'hFim', 'local', 'vala', 'atividade', 'obs'];
const identicos = voltaSemana.registros.filter((r) => {
  const o = semana.find((x) => x.id === r.id);
  return o && campos.every((c) => String(o[c]) === String(r[c]));
}).length;
ok(voltaSemana.estado === 'completo' && identicos === 60,
  `60 registros em ${partesSemana.length} QRs, lidos de trás para frente, voltam idênticos (${identicos}/60)`);
ok(partesSemana.every((p) => p.length <= 460), 'todos os QRs da semana dentro do limite de densidade');

console.log(falhas === 0 ? '\nTUDO PASSOU\n' : `\n${falhas} FALHA(S)\n`);
process.exit(falhas === 0 ? 0 : 1);
