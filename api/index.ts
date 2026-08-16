// Ponto de entrada serverless pra Vercel: reaproveita as mesmas rotas
// Express usadas no Cloud Run (server/routes/api.ts), só sem o app.listen()
// e sem a parte de servir os arquivos estáticos — isso a Vercel já faz
// sozinha a partir de dist/, via vercel.json.
import express from "express";
import dotenv from "dotenv";
import apiRoutes from "../server/routes/api";

dotenv.config();

const app = express();
app.use(express.json({ limit: "15mb" }));
app.use("/", apiRoutes);

export default app;
