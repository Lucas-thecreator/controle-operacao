/* ============================================================
   Gerador de .xlsx sem dependência externa.
   Um .xlsx é um ZIP com alguns XMLs dentro. Como os arquivos
   são pequenos, guardamos SEM compressão (método "stored"):
   evita embutir uma biblioteca de deflate inteira só por isso.
   ============================================================ */

/* ---------- CRC32 ---------- */
const TABELA = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(bytes) {
  let c = 0xFFFFFFFF;
  for (let i = 0; i < bytes.length; i++) c = TABELA[(c ^ bytes[i]) & 0xFF] ^ (c >>> 8);
  return (c ^ 0xFFFFFFFF) >>> 0;
}

/* ---------- ZIP (stored) ---------- */
function zip(arquivos) {
  const cod = new TextEncoder();
  const partes = [];
  const central = [];
  let deslocamento = 0;

  const buf = (n) => { const b = new Uint8Array(n); return { b, v: new DataView(b.buffer) }; };

  for (const arq of arquivos) {
    const nome = cod.encode(arq.nome);
    const dados = cod.encode(arq.conteudo);
    const crc = crc32(dados);

    const { b: lh, v: lv } = buf(30);
    lv.setUint32(0, 0x04034b50, true);
    lv.setUint16(4, 20, true);      // versão necessária
    lv.setUint16(6, 0, true);       // flags
    lv.setUint16(8, 0, true);       // método 0 = stored
    lv.setUint16(10, 0, true);      // hora
    lv.setUint16(12, 0x21, true);   // data (1980-01-01)
    lv.setUint32(14, crc, true);
    lv.setUint32(18, dados.length, true);
    lv.setUint32(22, dados.length, true);
    lv.setUint16(26, nome.length, true);
    lv.setUint16(28, 0, true);
    partes.push(lh, nome, dados);

    const { b: ch, v: cv } = buf(46);
    cv.setUint32(0, 0x02014b50, true);
    cv.setUint16(4, 20, true);
    cv.setUint16(6, 20, true);
    cv.setUint16(8, 0, true);
    cv.setUint16(10, 0, true);
    cv.setUint16(12, 0, true);
    cv.setUint16(14, 0x21, true);
    cv.setUint32(16, crc, true);
    cv.setUint32(20, dados.length, true);
    cv.setUint32(24, dados.length, true);
    cv.setUint16(28, nome.length, true);
    cv.setUint32(42, deslocamento, true);
    central.push(ch, nome);

    deslocamento += 30 + nome.length + dados.length;
  }

  const tamanhoCentral = central.reduce((s, p) => s + p.length, 0);
  const { b: fim, v: fv } = buf(22);
  fv.setUint32(0, 0x06054b50, true);
  fv.setUint16(8, arquivos.length, true);
  fv.setUint16(10, arquivos.length, true);
  fv.setUint32(12, tamanhoCentral, true);
  fv.setUint32(16, deslocamento, true);

  const todas = [...partes, ...central, fim];
  const total = todas.reduce((s, p) => s + p.length, 0);
  const saida = new Uint8Array(total);
  let p = 0;
  for (const parte of todas) { saida.set(parte, p); p += parte.length; }
  return saida;
}

/* ---------- planilha ---------- */
const xml = (s) => String(s ?? '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;');

const COL = (i) => String.fromCharCode(65 + i);

/* Excel conta dias desde 1899-12-30 */
function serial(iso) {
  const [a, m, d] = iso.split('-').map(Number);
  return Math.round((Date.UTC(a, m - 1, d) - Date.UTC(1899, 11, 30)) / 86400000);
}

const ESTILOS = [
  '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>',
  '<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">',
  '<numFmts count="2"><numFmt numFmtId="164" formatCode="dd/mm/yyyy"/><numFmt numFmtId="165" formatCode="0.0"/></numFmts>',
  '<fonts count="2"><font><sz val="11"/><name val="Calibri"/></font>',
  '<font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Calibri"/></font></fonts>',
  '<fills count="3"><fill><patternFill patternType="none"/></fill>',
  '<fill><patternFill patternType="gray125"/></fill>',
  '<fill><patternFill patternType="solid"><fgColor rgb="FF2F5597"/><bgColor indexed="64"/></patternFill></fill></fills>',
  '<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>',
  '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>',
  '<cellXfs count="4">',
  '<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>',
  '<xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1"/>',
  '<xf numFmtId="164" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>',
  '<xf numFmtId="165" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>',
  '</cellXfs></styleSheet>',
].join('');

/* colunas: {titulo, campo, tipo: 'texto'|'data'|'numero', largura} */
export function gerarXlsx(colunas, linhas, nomeAba) {
  const aba = nomeAba || 'Controle';

  const larguras = colunas.map((c, i) =>
    '<col min="' + (i + 1) + '" max="' + (i + 1) + '" width="' + (c.largura || 14) + '" customWidth="1"/>'
  ).join('');

  const cabecalho = '<row r="1">' + colunas.map((c, i) =>
    '<c r="' + COL(i) + '1" s="1" t="inlineStr"><is><t>' + xml(c.titulo) + '</t></is></c>'
  ).join('') + '</row>';

  const corpo = linhas.map((lin, n) => {
    const r = n + 2;
    const celulas = colunas.map((c, i) => {
      const ref = COL(i) + r;
      const v = lin[c.campo];
      if (v === null || v === undefined || v === '') return '';
      if (c.tipo === 'data') return '<c r="' + ref + '" s="2"><v>' + serial(v) + '</v></c>';
      if (c.tipo === 'numero') return '<c r="' + ref + '" s="3"><v>' + v + '</v></c>';
      return '<c r="' + ref + '" t="inlineStr"><is><t>' + xml(v) + '</t></is></c>';
    }).join('');
    return '<row r="' + r + '">' + celulas + '</row>';
  }).join('');

  const ultima = COL(colunas.length - 1) + (linhas.length + 1);

  const planilha = [
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>',
    '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">',
    '<sheetViews><sheetView workbookViewId="0">',
    '<pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/>',
    '</sheetView></sheetViews>',
    '<cols>' + larguras + '</cols>',
    '<sheetData>' + cabecalho + corpo + '</sheetData>',
    '<autoFilter ref="A1:' + ultima + '"/>',
    '</worksheet>',
  ].join('');

  const tipos = [
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>',
    '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">',
    '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>',
    '<Default Extension="xml" ContentType="application/xml"/>',
    '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>',
    '<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>',
    '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>',
    '</Types>',
  ].join('');

  const rels = [
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>',
    '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">',
    '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>',
    '</Relationships>',
  ].join('');

  const livro = [
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>',
    '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" ',
    'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">',
    '<sheets><sheet name="' + xml(aba) + '" sheetId="1" r:id="rId1"/></sheets>',
    '</workbook>',
  ].join('');

  const relsLivro = [
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>',
    '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">',
    '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>',
    '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>',
    '</Relationships>',
  ].join('');

  return zip([
    { nome: '[Content_Types].xml', conteudo: tipos },
    { nome: '_rels/.rels', conteudo: rels },
    { nome: 'xl/workbook.xml', conteudo: livro },
    { nome: 'xl/_rels/workbook.xml.rels', conteudo: relsLivro },
    { nome: 'xl/styles.xml', conteudo: ESTILOS },
    { nome: 'xl/worksheets/sheet1.xml', conteudo: planilha },
  ]);
}
