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

/* Operador, local, vala e tipo de serviço são texto livre no
   formulário — o operador digita. Estas três listas (operador,
   local, atividade) não aparecem mais como opções: elas só
   servem para o QR ficar menor (um valor que bate com a lista
   vira 1 caractere em vez do texto inteiro; o que não bate vai
   por extenso, sem erro). Ver app/js/pack.js.                  */
export const OPERADORES = [
  'Armando', 'Elismar', 'Glauber', 'Gustavo', 'Pedro',
];

export const LOCAIS = [
  'Classe I', 'Classe II', 'Classe II A',
];

export const ATIVIDADES = [
  'Compactação de resíduos',
  'Empurrar material',
  'Cobertura de manta',
  'Ampliação Classe II',
  'Rampa',
  'Pátio',
];

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
