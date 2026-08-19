# Beerlanda

E-commerce de produtos artesanais (sabonetes, bálsamos, velas e sais), com catálogo, cupons, avaliações e
o Clube da Colmeia (assinatura recorrente) — checkout via Mercado Pago (cartão e Pix) e frete calculado
pela API dos Correios.

## Stack

- **Frontend:** React 19 + Vite + TailwindCSS 4
- **Backend:** Express (`server.ts`), servido junto com o Vite em dev e como middleware estático em produção
- **Dados:** Firestore (Firebase Admin SDK) — única fonte de dados de produtos, cupons, avaliações, pedidos, clientes, assinantes e mensagens
- **Auth admin:** Firebase Auth (Google Sign-In); o portal `/admin` só libera acesso a e-mails listados em `ADMIN_EMAILS`
- **Pagamento:** Mercado Pago (Checkout Pro para compra avulsa, PreApproval para assinaturas recorrentes)
- **Frete:** API REST dos Correios, com renovação automática de token
- **Imagens:** Google Cloud Storage
- **Deploy:** Google Cloud Run (ver `Dockerfile`), build via Cloud Build

## Estrutura

```
server.ts                              # bootstrap do Express + Vite middleware
server/routes/api.ts                    # endpoints REST (produtos, cupons, avaliações, checkout, admin)
server/services/firestoreService.ts     # toda a leitura/escrita no Firestore
server/services/googleService.ts        # autenticação admin (verifica o token Google contra ADMIN_EMAILS)
server/services/mercadoPagoService.ts   # Checkout Pro (compra avulsa)
server/services/mercadoPagoSubscriptionService.ts  # PreApproval (Clube da Colmeia)
server/services/correiosService.ts      # cálculo de frete (PAC/SEDEX)
server/services/correiosAuthService.ts  # renovação automática do token Bearer dos Correios
server/services/storageService.ts       # upload de imagens de produto pro Cloud Storage
server/data/mock.ts                     # dados de fallback só usados se o Firestore estiver vazio
src/                                     # frontend React
src/components/admin/                   # portal administrativo (produtos, pedidos, cupons, avaliações, Clube)
src/lib/googleAuth.ts                   # sign-in Google (Firebase Auth) para o painel admin
```

## Configuração local

1. Instale as dependências:
   ```
   npm install
   ```
2. Copie `.env.example` para `.env` e preencha com os valores reais (credenciais do Mercado Pago, dos
   Correios, bucket do Cloud Storage, e-mails de admin). **Nunca commite o `.env`.**
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

## Dados (Firestore)

Produtos, cupons, avaliações, pedidos, clientes, assinantes do Clube da Colmeia e mensagens de contato
vivem só no Firestore — gerenciados direto pelo portal `/admin`. Não há mais nenhuma dependência de
planilha externa: o admin cria/edita tudo pela própria interface, incluindo upload de imagem de produto.

## Deploy (Google Cloud Run)

```
gcloud run deploy beerlanda --source . --region <region> --allow-unauthenticated \
  --set-env-vars ADMIN_EMAILS="...",CONTACT_EMAIL="...",CORREIOS_ORIGIN_CEP="...",CORREIOS_USER_ID="..." \
  --set-secrets MERCADOPAGO_ACCESS_TOKEN=MERCADOPAGO_ACCESS_TOKEN:latest,CORREIOS_API_KEY=CORREIOS_API_KEY:latest
```

O `Dockerfile` builda o frontend (Vite) e o servidor (esbuild) e serve tudo via Express; Cloud Build cuida
do build a partir do código-fonte, sem precisar de Docker local. O domínio customizado é mapeado via
Firebase Hosting (que faz proxy pro serviço do Cloud Run — ver `firebase.json`).

## Segurança da autenticação

- **Allowlist de admin:** as rotas `/api/admin/*` (`server/routes/api.ts`) exigem que o token Google
  enviado pertença a um e-mail listado em `ADMIN_EMAILS`
  (`server/services/googleService.ts#isAuthorizedAdmin`). O servidor valida o token diretamente com o
  endpoint `tokeninfo` do Google — nunca confia no e-mail que o cliente diz ter.
- **Rate limiting:** `/api/checkout`, `/api/validate-coupon`, `/api/shipping/calculate` e as rotas
  `/api/admin/*` têm limite de requisições (`express-rate-limit`) contra abuso/spam.
- **Pendências manuais (fora do escopo do código):**
  1. Habilitar o provedor **Google** em Firebase Console → Authentication → Sign-in method, no projeto
     `beerlanda`, e manter os domínios de produção em Authorized domains.
  2. O `accessToken` OAuth usado pelo login do admin expira (~1h) e não é renovado automaticamente — a
     conta precisa logar de novo quando expirar.
  3. O produto de API "Preço e Prazo" dos Correios precisa estar liberado no contrato vinculado a
     `CORREIOS_USER_ID` para o cálculo de frete funcionar — não é algo que o código controla.
