README — Deploy & verificação rápida

Este arquivo descreve passos recomendados para publicar o site "Mar de Ofertas" no Vercel e verificar o PWA / service worker e comportamento offline.

1) Conectar repositório ao Vercel
- Acesse https://vercel.com e faça login.
- Clique em "New Project" → "Import Git Repository" → escolha o repositório: `eoguimasx/Mar-de-ofertas`.
- Nas opções de importação:
  - Framework Preset: `Other` ou `Static` (nenhum build necessário).
  - Root Directory: deixar em branco (raiz do repositório).
  - Build Command: deixar vazio.
  - Output Directory: deixar vazio (ou `.` para raiz).
- Deploy: clique em "Deploy".

2) Configurações importantes no Vercel
- Environment Variables (opcional, recomendado):
  - Se preferir não manter `SUPABASE_ANON_KEY` no código, adicione as variáveis:
    - `SUPABASE_URL` → valor atual (colocar sem `https://`? use mesmo valor do código)
    - `SUPABASE_ANON_KEY` → chave anon
  - No entanto, o projeto hoje inclui a chave anon no `assets/js/main.js`. Trocar o uso para `process.env.SUPABASE_ANON_KEY` exigiria pequenas mudanças no build/run.
- Proteção de rota: o `vercel.json` já inclui cabeçalhos de segurança e um rewrite SPA. Não é necessário mais ajuste.

3) Verificação pós-deploy
- Logs de build: painel do projeto → Deploys → clique no deploy mais recente → View Build Logs.
- Acesse a URL fornecida pelo Vercel.
- Verifique recursos estáticos carregados (Ctrl+Shift+I → Network): `assets/js/main.js`, `assets/css/main.css`, `sw.js`, `manifest.webmanifest`.

4) Testes PWA / service worker
- No site aberto, abrir DevTools → Application (ou Manifest): confirme que `manifest.webmanifest` foi detectado.
- Em Application → Service Workers: verifique que `sw.js` apareceu e está `activated`/`running`.
- Teste offline: DevTools → Network → Offline (ou `Disable network`) e recarregue a página. A navegação deve mostrar a SPA (index.html) e os recursos precacheados.
- Teste navegação direta (roteamento SPA): abra uma rota arbitrária (ex: `/qualquer-coisa`) — a página deve reescrever para `index.html` e carregar a aplicação (graças ao `vercel.json`).

5) Problemas comuns e solução rápida
- Erro 404 em `sw.js` ou `manifest.webmanifest`: confirme que os arquivos estão no repositório na raiz (já estão: `sw.js`, `manifest.webmanifest`).
- Service worker não registra: abra Console e verifique mensagens; certifique-se de que `sw.js` é servido com `200` e sem `X-Content-Type-Options: nosniff` problemático (o `vercel.json` define `nosniff`, mas isso é seguro).
- CSP estrito bloqueando execução de inline scripts: evitamos inline scripts, então menos risco. Se usar políticas CSP, permita `script-src 'self'` e `worker-src 'self'`.

6) Teste local rápido (recomendado antes do deploy)
- Com Python 3: (a partir da pasta do projeto)

```bash
python -m http.server 8000
# ou
python -m http.server --bind 127.0.0.1 8000
```

- Com Node (npx http-server):

```bash
npx http-server -c-1 -p 8080
```

Acesse `http://localhost:8000` (ou `:8080`). O `service worker` só funciona em `http://localhost` ou `https`.

7) Como inspecionar/forçar novo deploy
- No painel do Vercel: Deploys → Trigger Redeploy.
- Ou crie uma nova commit e `git push` (o Vercel detecta e inicia novo deploy automaticamente).

8) Notas de segurança e manutenção
- `SUPABASE_ANON_KEY` é "publica" no sentido de ser a chave client-side para leitura pública, mas é melhor mantê-la em variáveis de ambiente se desejar trocá-la sem push de código.
- Para mudanças no `sw.js` (cache): incremente a versão dentro do arquivo (cache name) para forçar atualização do cache nos clientes.

9) Injetando variáveis de ambiente (`env.js`) — recomendado
- No painel do Vercel > Settings > Environment Variables, adicione `SUPABASE_URL` e `SUPABASE_ANON_KEY` (Environment: Production).
- Em Project Settings → General → Build & Development Settings, defina o *Build Command* para gerar `env.js` na raiz do projeto antes do deploy. Exemplo de comando (shell):

```bash
echo "window.__ENV__ = { SUPABASE_URL: '${SUPABASE_URL}', SUPABASE_ANON_KEY: '${SUPABASE_ANON_KEY}' };" > env.js
```

Isso cria um arquivo `env.js` com as variáveis necessárias; `assets/js/main.js` procura `window.__ENV__` automaticamente e faz fallback para os valores embarcados quando não existe `env.js`.

Observações:
- Não comite `env.js` com chaves reais no repositório. Use `env.example.js` como modelo local.
- Após deploy, verifique `env.js` na URL `https://<seu-site>/env.js` (deve retornar 200 e conter o objeto `window.__ENV__`).

Local (desenvolvimento)
- Para rodar localmente sem adicionar variáveis de ambiente, crie `env.js` a partir do modelo:

```bash
cp env.example.js env.js
# edite env.js e coloque suas chaves de desenvolvimento (não comite)
```

No repositório, `env.js` está listado no `.gitignore` para evitar commits acidentais de chaves.

---
Se quiser, eu posso: (a) criar um `README.md` atualizado combinando estas instruções, (b) abrir o painel do Vercel com instruções passo-a-passo, ou (c) ajustar o código para ler `SUPABASE_ANON_KEY` de `process.env` e documentar a mudança. O que prefere?