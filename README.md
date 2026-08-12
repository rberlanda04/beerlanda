# Beerlanda

E-commerce de produtos artesanais (sabonetes, velas, bálsamos e itens de bem-estar), com catálogo, cupons e avaliações sincronizados a partir de uma planilha Google Sheets, checkout via WhatsApp e assistente com Gemini AI.

## Stack

- **Frontend:** React 19 + Vite + TailwindCSS 4
- **Backend:** Express (server.ts), servido junto com o Vite em dev e como middleware estático em produção
- **Auth:** Firebase Auth (Google Sign-In) com escopos de `spreadsheets` e `drive` — usado para operações de admin que escrevem na planilha/Drive
- **Dados:** Google Sheets API (leitura pública via API key, escrita via OAuth do usuário admin) + Google Drive API (imagens dos produtos)
- **IA:** Gemini API (`@google/genai`)
- **Deploy:** Google Cloud Run (ver `Dockerfile`), build via Cloud Build

## Estrutura

```
server.ts                 # bootstrap do Express + Vite middleware
server/routes/api.ts       # endpoints REST (produtos, cupons, avaliações, checkout, admin)
server/services/googleService.ts  # leitura/escrita no Google Sheets e Drive
server/data/mock.ts        # dados de fallback quando o Sheets não responde
src/                        # frontend React
src/lib/googleAuth.ts       # sign-in Google (Firebase Auth) para o painel admin
google-apps-script/Code.gs  # script auxiliar rodado dentro da planilha (sincronizar fotos do Drive)
```

## Configuração local

1. Instale as dependências:
   ```
   npm install
   ```
2. Copie `.env.example` para `.env` e preencha com os valores reais (chave do Gemini, ID da planilha do Google Sheets, ID da pasta do Drive, API key do Google Cloud, telefone/e-mail de contato). **Nunca commite o `.env`.**
3. Ajuste `firebase-applet-config.json` se for usar um projeto Firebase diferente do padrão.
4. Rode o servidor de desenvolvimento:
   ```
   npm run dev
   ```

## Scripts

- `npm run dev` — sobe Express + Vite em modo desenvolvimento
- `npm run build` — build de produção do frontend (Vite) e bundle do servidor (esbuild)
- `npm start` — roda o build de produção (`dist/server.cjs`)
- `npm run lint` — checagem de tipos (`tsc --noEmit`)

## Integração com Google Sheets

- Leitura de produtos/cupons/avaliações funciona sem login, usando `GOOGLE_API_KEY` (somente leitura).
- Escrita (sincronizar planilha, renomear arquivos no Drive) exige login Google via `src/lib/googleAuth.ts`, que solicita os escopos `spreadsheets` e `drive` e usa o `accessToken` OAuth retornado pelo Firebase Auth como Bearer token nas chamadas às APIs do Google.

## Deploy (Google Cloud Run)

```
gcloud run deploy beerlanda --source . --region <region> --allow-unauthenticated \
  --set-env-vars ADMIN_EMAILS="...",WHATSAPP_PHONE="...",CONTACT_EMAIL="...",GOOGLE_SHEET_ID="...",GOOGLE_DRIVE_FOLDER_ID="..." \
  --set-secrets GOOGLE_API_KEY=GOOGLE_API_KEY:latest,GEMINI_API_KEY=GEMINI_API_KEY:latest
```

O `Dockerfile` builda o frontend (Vite) e o servidor (esbuild) e serve tudo via Express; Cloud Build cuida do build a partir do código-fonte, sem precisar de Docker local. Depois do primeiro deploy, um domínio customizado pode ser mapeado com `gcloud run domain-mappings create`, que gera o registro DNS (CNAME/A) a configurar no provedor do domínio.

## Segurança da autenticação

- **Allowlist de admin:** as rotas `/api/admin/*` (`server/routes/api.ts`) exigem que o token Google enviado pertença a um e-mail listado em `ADMIN_EMAILS` (`server/services/googleService.ts#isAuthorizedAdmin`). O servidor valida o token diretamente com o endpoint `tokeninfo` do Google — nunca confia no e-mail que o cliente diz ter. Sem isso, qualquer pessoa que fizesse login com sua própria conta Google poderia acionar a sincronização da planilha.
- **Rate limiting:** `/api/checkout`, `/api/validate-coupon` e as rotas `/api/admin/*` têm limite de requisições (`express-rate-limit`) contra abuso/spam.
- **Pendências manuais (fora do escopo do código):**
  1. Habilitar o provedor **Google** em Firebase Console → Authentication → Sign-in method, no projeto `beerlanda`, e adicionar os domínios de produção em Authorized domains (senão o `signInWithPopup` falha — provável causa do bug de login relatado).
  2. **Rotacionar a `GOOGLE_API_KEY`** no Google Cloud Console (APIs & Services → Credentials). Essa chave esteve hardcoded no código-fonte antes da limpeza feita neste repositório; trate-a como comprometida e gere uma nova, restrita apenas às APIs do Sheets/Drive e (se possível) ao domínio de produção.
  3. Revisar o compartilhamento da planilha e da pasta do Drive: confirme que só as contas em `ADMIN_EMAILS` têm permissão de **editor**; leitura pública "qualquer pessoa com o link" é esperada (é o que permite a `GOOGLE_API_KEY` ler sem login), mas edição pública não deveria estar habilitada.
  4. O `accessToken` OAuth usado nas escritas expira (~1h) e não é renovado automaticamente — o admin precisa logar de novo quando expirar. Migrar a escrita para uma Service Account no backend eliminaria essa dependência de login manual; ainda não implementado.
