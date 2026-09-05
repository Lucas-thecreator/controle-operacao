/* Escape de HTML.
   Todo texto que vem de fora — nome digitado em "Outro", local,
   atividade, observação — passa por aqui antes de virar HTML.

   Sem isso, um operador que digitasse <img src=x onerror="..."> no
   campo "Outro" executaria código no aparelho da supervisora, com
   acesso a tudo que ela já recolheu. O dado atravessa um QR code
   e vira tela do outro lado: é entrada externa, mesmo vindo de
   um colega.                                                     */
export const esc = (s) => String(s ?? '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#39;');
