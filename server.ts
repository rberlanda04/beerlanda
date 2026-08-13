import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import dotenv from "dotenv";
import apiRoutes from "./server/routes/api";

// Load environment variables
dotenv.config();

const app = express();
const PORT = Number(process.env.PORT) || 3000;

app.use(express.json({ limit: "15mb" }));

// API Routes
app.use("/", apiRoutes);

// -------------------------------------------------------------
// VITE DEV SERVER / PRODUCTION SERVING
// -------------------------------------------------------------
async function initServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
    console.log("[Vite] Middleware de desenvolvimento ativado.");
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
    console.log("[Vite] Servindo arquivos estáticos de produção.");
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`[Beerlanda Server] Rodando com sucesso na porta ${PORT}`);
    console.log(`[Beerlanda Server] Localtime: ${new Date().toISOString()}`);
  });
}

initServer().catch((err) => {
  console.error("Falha ao inicializar o servidor Express + Vite:", err);
});
