/* ============================================================
   CONFIGURAÇÃO — SOMA Ambiental / Controle de Operação
   ------------------------------------------------------------
   TUDO que sua irmã precisa revisar está NESTE arquivo.
   Alterou aqui? Basta publicar de novo: os celulares se
   atualizam sozinhos na próxima vez que virem internet.
   ============================================================ */

export const VERSAO_CONFIG = 1;

/* Máquinas — lista tirada do Google Forms dela (11 máquinas).
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

/* Operadores — os 5 confirmados na planilha. O caderno tinha
   mais nomes, mas a letra não permitiu ler com segurança
   ("Ronaldo"? "Reinaldo"? / "Ailson"? "Gilson"?).
   Enquanto a lista não estiver completa, ninguém fica travado:
   existe a opção "Outro" em todo campo de lista.              */
export const OPERADORES = [
  'Armando', 'Elismar', 'Glauber', 'Gustavo', 'Pedro',
];

/* Locais — no caderno vinha tudo junto e escrito de 6 jeitos
   ("CI I", "Cl I", "CLA II A", "Classe 2A"). Aqui vira lista. */
export const LOCAIS = [
  'Classe I', 'Classe II', 'Classe II A',
];

/* Vala — no caderno aparecia colada no Local ("Vala 03 / Cl I").
   Hoje essa informação SE PERDE na transcrição para o Excel.
   Vira campo próprio e opcional, em coluna extra no final.     */
export const VALAS = ['1', '2', '3', '4', '5', '6', '7', '8'];

/* Tipos de serviço — união do que aparece no caderno e na
   planilha, já com a grafia padronizada.                       */
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

export const ROTULO_OUTRO = 'Outro (escrever)';

/* Código do modo "Faço a planilha".
   TROQUE ESTE VALOR antes de publicar, e passe só para ela.

   É uma tranca de porta, não um cofre: quem abrir o código-fonte
   da página consegue ler. Serve para o que precisa servir — que
   um operador não entre sem querer e exporte ou apague a coleta.
   Guardar de verdade exigiria servidor, que este app não tem
   justamente por não haver internet no local.                  */
export const CODIGO_SUPERVISORA = '5555';
