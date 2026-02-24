import express from "express";
import { createServer as createViteServer } from "vite";
import dotenv from "dotenv";
import dataHandler from "./api/data.js";
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
  const client = new ftp.Client();
  client.ftp.verbose = false;
  
  try {
    const host = (process.env.FTP_HOST || "").replace(/['"]/g, "");
    const user = (process.env.FTP_USER || "").replace(/['"]/g, "");
    const password = (process.env.FTP_PASSWORD || "").replace(/['"]/g, "");
    let path = (process.env.FTP_PATH || "").replace(/['"]/g, "");

    if (!host || !user || !password) {
      return res.status(500).send("FTP configuration missing");
    }

    await client.access({
      host,
      user,
      password,
      secure: false
    });

    const dir = path.includes('/') ? path.substring(0, path.lastIndexOf('/') + 1) : '';
    const logoPath = `${dir}logo.png`;

    const chunks: any[] = [];
    const writableStream = new Stream.Writable({
      write(chunk, encoding, next) {
        chunks.push(chunk);
        next();
      }
    });

    await client.downloadTo(writableStream, logoPath);
    const buffer = Buffer.concat(chunks);

    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Cache-Control', 'public, max-age=3600');
    res.send(buffer);
  } catch (error: any) {
    console.error("Logo fetch error:", error);
    res.status(404).send("Logo not found");
  } finally {
    client.close();
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
