# JARVIS — Deploy Guide de Produção

## Arquitetura de Deploy

```
[Vercel]  ←→  Browser  ←→  [Render]
Frontend                    Backend (Express + Socket.IO)
React/Vite                  Node.js + Anthropic + OpenAI + Supabase
Static files                WebSocket / streaming
```

> **Importante:** O streaming da Anthropic acontece inteiramente no Render.
> A Vercel serve apenas arquivos estáticos — timeout da Vercel é irrelevante aqui.

---

## Parte 1 — Backend no Render

### 1.1 Criar o serviço

1. Acesse [render.com](https://render.com) → **New → Web Service**
2. Conecte o repositório `github.com/monielfer/jarvis`
3. Configure:

| Campo | Valor |
|---|---|
| **Name** | `jarvis-backend` |
| **Root Directory** | *(deixe vazio — usa a raiz)* |
| **Runtime** | `Node` |
| **Build Command** | `cd backend && npm install` |
| **Start Command** | `node backend/src/server.js` |
| **Health Check Path** | `/health` |
| **Plan** | Starter ($7/mês) — necessário para WebSocket persistente |

> ⚠️ **Free plan do Render hiberna após 15 min de inatividade** e mata WebSockets.
> Use no mínimo o plano **Starter** para Socket.IO funcionar em produção.

### 1.2 Variáveis de Ambiente — Render

No painel do Render → **Environment** → cole estes valores:

```
NODE_ENV=production
PORT=3001
FRONTEND_URL=https://SEU-APP.vercel.app
ANTHROPIC_API_KEY=sk-ant-...
OPENAI_API_KEY=sk-proj-...
SUPABASE_URL=https://SEU-PROJETO.supabase.co
SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_KEY=eyJ...
```

> Substitua `FRONTEND_URL` pela URL real da Vercel após o deploy do frontend.

---

## Parte 2 — Frontend na Vercel

### 2.1 Criar o projeto

1. Acesse [vercel.com](https://vercel.com) → **New Project**
2. Importe `github.com/monielfer/jarvis`
3. Vercel detecta o `vercel.json` automaticamente — não altere as configurações de build

### 2.2 Variáveis de Ambiente — Vercel

No painel da Vercel → **Settings → Environment Variables** → adicione:

```
VITE_API_URL=https://jarvis-backend.onrender.com
VITE_SOCKET_URL=https://jarvis-backend.onrender.com
```

> Substitua `jarvis-backend.onrender.com` pela URL real do seu serviço no Render.
> Ambas as variáveis apontam para o mesmo backend — uma para HTTP, outra para WebSocket.

---

## Parte 3 — Ordem de Deploy

```
1. Deploy backend no Render  →  anote a URL (ex: https://jarvis-backend.onrender.com)
2. Cole a URL no Render ENV:     FRONTEND_URL=https://SEU-APP.vercel.app  (preencher depois)
3. Deploy frontend na Vercel  →  anote a URL (ex: https://jarvis-abc.vercel.app)
4. Atualize no Render ENV:       FRONTEND_URL=https://jarvis-abc.vercel.app
5. Redeploy do backend para CORS pegar a URL correta
```

---

## Parte 4 — Vercel Timeout e Streaming (Análise @researcher)

### A pergunta
> "A Vercel tem limites de timeout para streaming de texto da Anthropic?"

### A resposta

**Não é um problema para esta arquitetura.** Veja o motivo:

| Plano Vercel | Timeout padrão | Edge Runtime |
|---|---|---|
| Hobby | 10 segundos | Sem timeout (mas sem Node.js APIs) |
| Pro | 60 segundos | Sem timeout |
| Enterprise | 900 segundos | Sem timeout |

O timeout da Vercel afetaria apenas se o backend (Express + Anthropic) rodasse como **Serverless Function na Vercel**. No JARVIS, isso não acontece:

```
Browser → Vercel (busca index.html) → [fim da responsabilidade da Vercel]
Browser → Render (WebSocket Socket.IO permanente) → Claude Streaming
```

O streaming da Anthropic vai de `Render → Browser` via Socket.IO WebSocket — nunca passa pela Vercel.

### Se no futuro você quiser rodar o backend na Vercel (não recomendado para este projeto)

- Seria necessário usar **Edge Runtime** (`export const runtime = 'edge'`)
- Edge Runtime não tem timeout, mas não suporta `fs`, `crypto` nativo, `Buffer`, nem `Socket.IO`
- Socket.IO é incompatível com Edge Runtime (precisa de WebSocket persistente)
- **Conclusão: mantenha backend no Render. Vercel só para o frontend estático.**

---

## Parte 5 — Checklist de Produção

- [ ] Backend rodando no Render com plano Starter ou superior
- [ ] `/health` retorna `{ "status": "JARVIS ONLINE" }`
- [ ] `FRONTEND_URL` no Render aponta para URL correta da Vercel (CORS)
- [ ] `VITE_API_URL` e `VITE_SOCKET_URL` na Vercel apontam para URL correta do Render
- [ ] Frontend abre no browser sem erros de CORS
- [ ] Badge ONLINE aparece na interface
- [ ] Teste de mensagem de texto funcionando
- [ ] Teste de voz funcionando

---

*Guia gerado por @dev + @researcher — JARVIS v1.0*
