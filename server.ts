import express from "express";
import { createServer as createViteServer } from "vite";
import * as ftp from "basic-ftp";
import * as XLSX from "xlsx";
import dotenv from "dotenv";
import { Stream } from "stream";

dotenv.config();

const app = express();
const PORT = 3000;

// Helper function to fetch and parse Excel from FTP
async function fetchExcelFromFTP() {
  const client = new ftp.Client();
  client.ftp.verbose = false;
  
  try {
    const host = (process.env.FTP_HOST || "").replace(/['"]/g, "");
    const user = (process.env.FTP_USER || "").replace(/['"]/g, "");
    const password = (process.env.FTP_PASSWORD || "").replace(/['"]/g, "");
    let path = (process.env.FTP_PATH || "").replace(/['"]/g, "");

    if (!path || path === "/") {
      path = "schade met macro.xlsm";
    }

    if (!host || !user || !password) {
      throw new Error(`Configuratie ontbreekt: Host=${!!host}, User=${!!user}, Pass=${!!password}`);
    }

    console.log(`Connecting to FTP: ${host} as ${user}, fetching: ${path}`);

    await client.access({
      host,
      user,
      password,
      secure: false
    });

    // Create a buffer to store the file content
    const chunks: any[] = [];
    const writableStream = new Stream.Writable({
      write(chunk, encoding, next) {
        chunks.push(chunk);
        next();
      }
    });

    await client.downloadTo(writableStream, path);
    const buffer = Buffer.concat(chunks);
    
    // Parse Excel
    const wb = XLSX.read(buffer, { type: 'buffer', cellDates: true });
    const wsname = 'BRON';
    const ws = wb.Sheets[wsname];
    
    if (!ws) {
      throw new Error('Tabblad "BRON" niet gevonden in het Excel bestand op FTP.');
    }

    const rawData = XLSX.utils.sheet_to_json(ws) as any[];
    return rawData;
  } catch (err) {
    console.error("FTP Fetch Error:", err);
    throw err;
  } finally {
    client.close();
  }
}

// API Endpoint to get data
app.get("/api/data", async (req, res) => {
  try {
    const data = await fetchExcelFromFTP();
    res.json({ success: true, data });
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
