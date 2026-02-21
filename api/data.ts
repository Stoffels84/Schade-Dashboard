import * as ftp from "basic-ftp";
import * as XLSX from "xlsx";
import { Stream } from "stream";

export default async function handler(req: any, res: any) {
  // Only allow GET requests
  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

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
      const missing = [];
      if (!host) missing.push("FTP_HOST");
      if (!user) missing.push("FTP_USER");
      if (!password) missing.push("FTP_PASSWORD");
      
      return res.status(500).json({ 
        success: false, 
        error: `Vercel Configuratie Fout: De volgende variabelen ontbreken in je Vercel Dashboard: ${missing.join(", ")}. Voeg deze toe bij Settings -> Environment Variables en doe een Redeploy.` 
      });
    }

    await client.access({
      host,
      user,
      password,
      secure: false
    });

    const chunks: any[] = [];
    const writableStream = new Stream.Writable({
      write(chunk, encoding, next) {
        chunks.push(chunk);
        next();
      }
    });

    await client.downloadTo(writableStream, path);
    const buffer = Buffer.concat(chunks);
    
    const wb = XLSX.read(buffer, { type: 'buffer', cellDates: true });
    const wsname = 'BRON';
    const ws = wb.Sheets[wsname];
    
    if (!ws) {
      throw new Error('Tabblad "BRON" niet gevonden in het Excel bestand op FTP.');
    }

    const rawData = XLSX.utils.sheet_to_json(ws) as any[];
    
    res.status(200).json({ success: true, data: rawData });
  } catch (error: any) {
    console.error("Vercel API Error:", error);
    res.status(500).json({ success: false, error: error.message });
  } finally {
    client.close();
  }
}
