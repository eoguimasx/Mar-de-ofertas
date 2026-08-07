Mar de Ofertas — Site estático

Arquivos principais:
- `Mar de Ofertas - 2026-08.html` — página principal (já presente).

Como abrir localmente:

Opção 1 — Abrir direto no navegador
- No Windows, dê duplo clique em `Mar de Ofertas - 2026-08.html`.
- Algumas funcionalidades que usam `fetch` e IndexedDB podem requerer um servidor local.

Opção 2 — Servidor HTTP fácil (recomendado)
- Com Python 3 instalado:

```bash
# servido na porta 8000
python -m http.server 8000
```
Depois abra `http://localhost:8000/Mar%20de%20Ofertas%20-%202026-08.html`.

Opção 3 — usar npm `serve` (se preferir):

```bash
npm install -g serve
serve -l 5000
```

Observações:
- O site usa Supabase para sincronização remota; as chaves e URL já estão embutidas no HTML para demonstrar funcionamento.
- Para produção, remova chaves sensíveis do cliente e use um backend seguro.

PWA / offline:
- Foi adicionado um service worker (`sw.js`) que faz cache dos arquivos principais para abrir offline.
- Há também `manifest.webmanifest` e `favicon.svg` para PWA/instalação.

Notas de segurança:
- A `SUPABASE_ANON_KEY` presente no HTML é a chave pública (anon). Não use chaves administrativas no cliente.
- Para produção, mova operações sensíveis para um backend protegido.

Precisa que eu também:
- finalize a extração do JavaScript inline para `assets/js/main.js` e remova o `<script>` embutido do HTML (posso fazer isso).
- substituir o CSS inline por `assets/css/main.css` (já criado) e remover o bloco `<style>` do HTML.
- gerar um `package.json` e um pequeno `serve` script para desenvolvimento.
