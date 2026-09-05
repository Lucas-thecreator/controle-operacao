/* Armazenamento local (IndexedDB). Nada aqui sai do aparelho
   sozinho — a saída é sempre um ato explícito do usuário.     */

const NOME_DB = 'soma-controle';
const VERSAO_DB = 1;
let _db = null;

function abrir() {
  if (_db) return Promise.resolve(_db);
  return new Promise((ok, erro) => {
    const req = indexedDB.open(NOME_DB, VERSAO_DB);
    req.onupgradeneeded = (ev) => {
      const db = ev.target.result;
      if (!db.objectStoreNames.contains('registros')) {
        const st = db.createObjectStore('registros', { keyPath: 'id' });
        st.createIndex('porData', 'data');
        st.createIndex('porEntrega', 'entregue');
      }
      if (!db.objectStoreNames.contains('kv')) {
        db.createObjectStore('kv');
      }
    };
    req.onsuccess = () => { _db = req.result; ok(_db); };
    req.onerror = () => erro(req.error);
  });
}

function tx(store, modo, fn) {
  return abrir().then((db) => new Promise((ok, erro) => {
    const t = db.transaction(store, modo);
    const req = fn(t.objectStore(store));
    t.oncomplete = () => ok(req && req.result);
    t.onerror = () => erro(t.error);
    t.onabort = () => erro(t.error);
  }));
}

/* ---- registros ---- */
export const salvarRegistro = (r) => tx('registros', 'readwrite', (s) => s.put(r));
export const apagarRegistro = (id) => tx('registros', 'readwrite', (s) => s.delete(id));
export const listarRegistros = () => tx('registros', 'readonly', (s) => s.getAll())
  .then((rs) => (rs || []).sort((a, b) => (a.data + a.criadoEm).localeCompare(b.data + b.criadoEm)));

export async function salvarVarios(registros) {
  const db = await abrir();
  return new Promise((ok, erro) => {
    const t = db.transaction('registros', 'readwrite');
    const store = t.objectStore('registros');
    let novos = 0, repetidos = 0;
    let pendentes = registros.length;
    if (!pendentes) { t.oncomplete = () => ok({ novos, repetidos }); return; }
    registros.forEach((r) => {
      const g = store.get(r.id);
      g.onsuccess = () => {
        if (g.result) { repetidos++; }      // já entrou antes: ignora em silêncio
        else { store.put(r); novos++; }
        if (--pendentes === 0) { /* espera oncomplete */ }
      };
    });
    t.oncomplete = () => ok({ novos, repetidos });
    t.onerror = () => erro(t.error);
  });
}

/* ---- preferências / estado ---- */
export const guardar = (k, v) => tx('kv', 'readwrite', (s) => s.put(v, k));
export const ler = (k) => tx('kv', 'readonly', (s) => s.get(k));

/* Não existe aqui nenhum resumo de "última leitura por máquina".
   Guardar isso parecia econômico, mas embutia a suposição de que
   os lançamentos chegam em ordem cronológica — e ela quebra no
   primeiro registro retroativo. A posição na cadeia é sempre
   derivada dos registros, em acharVizinhos() (validacao.js).   */
