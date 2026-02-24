import express from "express";
import { createServer as createViteServer } from "vite";
import dotenv from "dotenv";
import dataHandler from "./api/data.js";
import logoHandler from "./api/logo.js";
import * as ftp from "basic-ftp";
import { Stream } from "stream";

dotenv.config();

const app = express();
const PORT = 3000;

// API Endpoint to get data (using the same handler as Vercel)
app.get("/api/data", async (req, res) => {
  try {
    // We wrap the Vercel handler to work with Express
    await dataHandler(req, res);
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// API Endpoint to get the logo from FTP
app.get("/api/logo", async (req, res) => {
  try {
    await logoHandler(req, res);
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Vite middleware for development
async function setupVite() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    // In production, serve static files from dist
    app.use(express.static("dist"));
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

setupVite();
