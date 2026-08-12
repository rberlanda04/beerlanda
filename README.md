# Beerlanda

E-commerce de produtos artesanais (sabonetes, velas, bálsamos e itens de bem-estar), com catálogo, cupons e avaliações sincronizados a partir de uma planilha Google Sheets, checkout via WhatsApp e assistente com Gemini AI.

## Stack

- **Frontend:** React 19 + Vite + TailwindCSS 4
- **Backend:** Express (server.ts), servido junto com o Vite em dev e como middleware estático em produção
- **Auth:** Firebase Auth (Google Sign-In) com escopos de `spreadsheets` e `drive` — usado para operações de admin que escrevem na planilha/Drive
- **Dados:** Google Sheets API (leitura pública via API key, escrita via OAuth do usuário admin) + Google Drive API (imagens dos produtos)
- **IA:** Gemini API (`@google/genai`)
- **Deploy:** Railway (ver `railway.toml`), build via Nixpacks

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
