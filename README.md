# Controle de Operação

Substitui o caderno manuscrito de horas de máquina por um app que funciona
**sem internet nenhuma** e entrega a planilha pronta, no mesmo formato que já
é usado hoje.

## O problema, como ele é de verdade

- 11 máquinas, cada uma com seu caderno de papel.
- Os operadores ficam em pontos separados, alguns distantes entre si.
- Não há sinal de celular utilizável nos pontos de trabalho.
- A supervisora passa lá **toda quinta**, fotografa os cadernos e depois digita
  tudo na planilha. Quando não consegue ir, alguém manda as fotos.

Duas coisas custam caro: a digitação semanal e a correção do que vem errado
do papel.

## O desenho

**Captura** — o operador registra no próprio celular, offline. O app grava
localmente na hora; nada depende de rede em nenhum momento do preenchimento.

O horímetro inicial **não é preenchido pelo app**. Ele é uma leitura do painel
da máquina, não um número dedutível: sugerir o valor convidaria o operador a
aceitar sem olhar, e o campo viraria cópia do registro anterior em vez de
observação — deixando a cadeia bonita e possivelmente errada.

A conferência acontece na hora de salvar, comparando a leitura com o registro
anterior **daquela máquina naquela data**. Por isso lançar um turno esquecido de
ontem funciona: a ordem em que se digitou não importa, e o app avisa se o
lançamento retroativo invadir um registro que já existe adiante. Ninguém precisa
apagar nada para corrigir a sequência.

O modo "Faço a planilha" pede um código, definido em `config.js`. É uma tranca
de porta, não um cofre — quem abrir o código-fonte da página consegue lê-lo.
Serve para o que precisa servir: impedir que um operador entre sem querer e
exporte ou apague a coleta.

**Entrega** — três caminhos, de propósito, porque cada um falha por um motivo
diferente e nenhum pode ser ponto único:

| Caminho | Quando serve | O que exige |
|---|---|---|
| **Enviar** (WhatsApp/compartilhar) | O celular achou internet em algum momento — em casa, na cidade | Internet uma vez, um toque |
| **QR na tela** | Ela está na frente do operador (a visita de quinta) | Nada |
| **Texto copiado** | Qualquer canal de recado serve | Nada além de um jeito de mandar mensagem |

O ponto que sustenta o desenho: **ele nunca fica pior que hoje**. Quem enviar,
ela não precisa visitar. Quem não enviar, ela escaneia na quinta, exatamente
como já faz.

**Recolhimento** — no aparelho dela (celular ou PC), pela câmera, por foto de
QR que mandaram, ou colando o texto. Registro repetido nunca duplica: cada um
tem id próprio.

**Saída** — `.xlsx` com as 8 colunas dela, na mesma ordem, mais `Vala` e
`Observação` no fim (dá para ignorar). Também exporta `.csv`.

## O que o app conserta além da digitação

Coisas encontradas no caderno e na planilha reais:

- **Horímetro andando para trás** — `3149,4 → 3149,0` no caderno. Agora é
  bloqueado no ato.
- **Salto sem registro** — de `3145,4` para `3149,4`, 4 h que ninguém lançou.
  A conferência aponta o buraco, com as duas datas e os dois operadores.
- **Data inconsistente** — `17/08` e `19/08/26` na mesma página. Agora é campo
  de data, sempre completo.
- **Decimal misturado** — `3142,1` e `3142.1`. Aceita os dois, grava um só.
- **Local escrito de seis jeitos** — `CI I`, `Cl I`, `CLA II A`, `Classe 2A`.
  Virou lista.
- **Vala perdida na transcrição** — o caderno traz `Vala 03`, a planilha
  descarta. Agora tem coluna própria.
- **Erro de transcrição** — há linha na planilha com o nome do operador
  parado na coluna *Local*. Some por construção: o dado nunca é redigitado.
- **Colunas que ninguém precisa digitar** — `Máquina` vem da escolha no app e
  `Horas trabalhada` é subtração. Duas das oito colunas somem do trabalho dela.

## Rodar aqui

```bash
npm install
npm test        # xlsx e ida-e-volta do QR
npm run servir  # http://localhost:8080
```

`npm run icones` regenera os ícones (só se mudar o desenho).

## Publicar

O app precisa de **HTTPS** uma única vez, para instalar. Depois disso cada
celular funciona offline para sempre, e se atualiza sozinho quando encontrar
internet.

1. Suba a pasta `app/` em qualquer host estático com HTTPS (GitHub Pages,
   Netlify, Cloudflare Pages — todos gratuitos neste tamanho).
2. Em cada celular, abrir o endereço **uma vez, com internet**, e usar
   "Adicionar à tela de início".
3. A partir daí, nunca mais precisa de rede.

A instalação pode ser feita em qualquer lugar — na casa dela, na cidade, onde
pegar sinal. Não precisa ser no local de trabalho.

## O que revisar antes de usar de verdade

Tudo em [`app/js/config.js`](app/js/config.js):

- **Operadores** — só os nomes que apareciam na planilha estão na lista. O
  caderno tinha mais, mas a letra não permitiu ler com segurança. Enquanto a
  lista não fecha, ninguém trava: todo campo de lista tem "Outro (escrever)".
- **Máquinas** — as 11 do Forms estão lá. Só a TEA 279 aparecia como
  `(Locado)` na planilha; confirmar quais outras são locadas, porque isso vai
  para a coluna *Máquina* do Excel.
- **Locais e tipos de serviço** — montados a partir do que apareceu no caderno
  e na planilha. Ela deve conferir se falta algum.
- **`CODIGO_SUPERVISORA`** — trocar antes de publicar e passar só para ela.

Mudou aqui? Publique de novo — os celulares se atualizam sozinhos.

## Segurança

O que o app protege, e contra o quê:

- **Texto que vira código na tela.** Nome, local, atividade e observação podem
  ser texto livre e atravessam um QR até o aparelho de outra pessoa. Tudo passa
  por escape de HTML antes de virar tela (`js/texto.js`), e uma CSP sem
  `unsafe-inline` barra script injetado mesmo que algo escape.
- **Texto que vira fórmula no Excel.** O Excel avalia célula que começa com
  `=` `+` `-` `@`, inclusive em CSV entre aspas. O CSV desarma com apóstrofo;
  o `.xlsx` grava tudo como `inlineStr`, que nunca é fórmula.
- **Modo da supervisora.** Protegido por código, guardado como PBKDF2-SHA256
  com 600 mil iterações e sal próprio — o repositório é público e o código em
  si não existe em lugar nenhum do projeto. Troque com `npm run codigo`.
- **Nada sai do aparelho sozinho.** `connect-src 'self'` na CSP: o app não
  consegue enviar dado para lugar nenhum. Toda saída é ato explícito de quem
  está usando — compartilhar, baixar ou mostrar o QR.

O que ele **não** protege:

- O código de acesso resiste a curiosidade, não a alguém decidido. Cada
  tentativa custa ~30 ms, então 4 dígitos caem em uns 5 minutos. **Use 10+
  caracteres com letras** — aí o custo passa de qualquer prazo útil.
- Quem tem o link enxerga a lista de operadores e máquinas: o app é
  client-side e precisa dessa lista para funcionar. Sem servidor não há como
  esconder, e não há servidor porque não há internet no local.
- Os dados coletados ficam sem criptografia no armazenamento do navegador.
  Quem destravar o aparelho dela lê a coleta da semana.

## Riscos conhecidos

- **Ciclo semanal concentra perda.** Celular perdido ou app limpo na quarta
  leva até uma semana de registros. O app avisa de forma insistente enquanto
  houver coisa não entregue, e permite entregar a qualquer momento. Vale manter
  o caderno de papel em paralelo nas primeiras semanas.
- **A via "Enviar" depende de os operadores terem WhatsApp e pegarem internet
  em algum momento fora do trabalho.** Se não for o caso, restam as outras duas.
- **Câmera não foi testada em aparelho real** — só as vias de foto e texto, que
  usam o mesmo decodificador. Testar no celular dela antes de soltar.

## Estrutura

```
app/
  index.html          telas
  styles.css
  sw.js               cache offline
  manifest.json
  js/
    config.js         >>> o que ela precisa revisar <<<
    operador.js       formulário
    entrega.js        as três vias de entrega
    supervisora.js    recolher, conferir, exportar
    validacao.js      erros (travam) e avisos (perguntam)
    planilha.js       contrato das colunas do Excel
    pack.js           formato compacto do QR
    xlsxgen.js        gerador de .xlsx sem dependência
    db.js             IndexedDB
  vendor/             qrcode-generator, jsQR
tools/
  teste.js            npm test
  servidor.js         npm run servir
  icones.js           npm run icones
```
