/* ============================================================
   CONFIGURAÇÃO — Controle de Operação
   ------------------------------------------------------------
   TUDO que sua irmã precisa revisar está NESTE arquivo.
   Alterou aqui? Basta publicar de novo: os celulares se
   atualizam sozinhos na próxima vez que virem internet.
   ============================================================ */

export const VERSAO_CONFIG = 1;

/* Máquinas (11).
   `planilha` é o texto que sai NA COLUNA "Máquina" do Excel.
   Só a TEA 279 aparecia como "(Locado)" na planilha; as outras
   estão sem sufixo até ela confirmar quais são locadas.        */
export const MAQUINAS = [
  { id: 'EH05',  nome: 'EH 05',   planilha: 'EH 05' },
  { id: 'EH09',  nome: 'EH 09',   planilha: 'EH 09' },
  { id: 'EP02',  nome: 'EP 02',   planilha: 'EP 02' },
  { id: 'PP01',  nome: 'PP 01',   planilha: 'PP 01' },
  { id: 'RE01',  nome: 'RE 01',   planilha: 'RE 01' },
  { id: 'TE03',  nome: 'TE 03',   planilha: 'TE 03' },
  { id: 'TEA279',nome: 'TEA 279', planilha: 'TEA 279 (Locado)' },
  { id: 'TEA340',nome: 'TEA 340', planilha: 'TEA 340' },
  { id: 'TP44',  nome: 'TP 44',   planilha: 'TP 44' },
  { id: 'TP45',  nome: 'TP 45',   planilha: 'TP 45' },
  { id: 'TP52',  nome: 'TP 52',   planilha: 'TP 52' },
];

/* Operador e vala são texto livre — o operador digita.
   Local e tipo de serviço são lista fechada, abaixo.

   Pode mexer nestas listas à vontade: o QR leva o texto, não a
   posição na lista, então celular desatualizado não embaralha
   nada do lado dela. Ver app/js/pack.js.                       */

/* Local — na ordem em que ela mandou.                          */
export const LOCAIS = [
  'Classe II',
  'Classe I',
  'RCD',
  'ETE',
  'Compostagem',
  'Oficina',
  'Bota fora',
  'Almoxarifado Aberto',
  'Balança',
  'Quarentena',
  'APP',
  'Municipal',
  'Administrativo',
];

/* Tipo de serviço — cada máquina só mostra o que ela faz.
   Texto exatamente como veio da planilha dela, porque é o que
   vai para a coluna "Tipo de serviço" do Excel.                */
const SERVICOS_TEA = [
  'Compactação de Resíduos',
  'Cobertura de resíduo',
  'Empurrando entulho',
  'Ampliação',
  'Acesso',
  'Pátio',
  'Terraplanagem',
];

const SERVICOS_EH = [
  'Remonte de resíduos',
  'Carregamento de resíduos',
  'Solidificação',
  'Dreno',
  'Carregamento de terra',
  'Biogás',
  'Cobertura de resíduo',
  'Carregamento de entulho',
  'Escavação',
  'Auxilio descarregamento',
];

export const ATIVIDADES_POR_MAQUINA = {
  TEA279: SERVICOS_TEA,
  TEA340: SERVICOS_TEA,
  EH05: SERVICOS_EH,
  EH09: SERVICOS_EH,
  TP52: [
    'Sucção de lodo',
    'Sucção de óleo',
    'Abafamento',
    'Roçada',
    'Sucção de chorume',
    'Aspersão de água',
    'Sucção de fossa',
    'Sucção de resíduo',
    'Transferência',
  ],
  TE03: [
    'Cobertura de resíduo',
    'Empurrando entulho',
    'Compactação de Resíduos',
    'Cobertura da Manta PEAD',
    'Arrumando acesso',
    'Empurrando terra',
    'Pátio',
    'Conformização de talude',
    'Movimentação de terra',
    'Aceiro',
    'Terraplanagem',
  ],
  EP02: [
    'Descarga e movimentação de tambores',
    'Descarga e movimentação de IBCs',
    'Descarga',
  ],
  PP01: [
    'Carregamento de Pó de Celulose e Terra',
    'Carregamento de Pedra',
    'Remonte de resíduos',
    'Movimentação de tambores',
    'Dreno na frente de resíduos',
    'Aceiro',
    'Limpeza',
    'Carregamento de manta',
    'Carregamento de entulho',
    'Acesso',
  ],
  RE01: [
    'Solidificação',
  ],
  /* TP 44 e TP 45 não vieram na lista dela. Até virem, mostram
     todas as atividades — ver atividadesDa(), logo abaixo.     */
};

/* Serviços de uma máquina. Máquina sem lista própria recebe
   todos, em ordem alfabética: o operador nunca fica sem opção. */
export function atividadesDa(maquinaId) {
  const propria = ATIVIDADES_POR_MAQUINA[maquinaId];
  if (propria) return propria;
  const todas = new Set(Object.values(ATIVIDADES_POR_MAQUINA).flat());
  return [...todas].sort((a, b) => a.localeCompare(b, 'pt-BR'));
}

/* Regras de validação (limites de sanidade, não de bloqueio,
   exceto onde marcado como bloqueante no formulário).          */
export const REGRAS = {
  horasMaximasTurno: 14,     // acima disso: avisa
  saltoHorimetroAviso: 0.2,  // divergência da última leitura que gera aviso
  horimetroMin: 0,
  horimetroMax: 100000,
};

/* Código do modo "Faço a planilha".

   O repositório é público, então aqui fica só o HASH — o código
   em si não existe em lugar nenhum do projeto.

   Para trocar:  npm run codigo -- "seu-codigo-aqui"
   e cole o resultado em CODIGO_HASH.

   Use 10+ caracteres com letras. Ver app/js/codigo.js para o
   que essa proteção alcança e o que ela não alcança.          */
export const CODIGO_SAL = '1bfefdf181039540a901d50247232740';
export const CODIGO_HASH = 'de8d02e2af73f091d3e00859ae13be908110d5cd44342a81d34ce9dff6e22140';
