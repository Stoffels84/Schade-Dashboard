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
    
    // Fetch BRON data
    const wsBron = wb.Sheets['BRON'];
    if (!wsBron) {
      throw new Error('Tabblad "BRON" niet gevonden in het Excel bestand op FTP.');
    }
    const bronData = XLSX.utils.sheet_to_json(wsBron) as any[];

    // Fetch schades-dienstjaar data
    const sheetNames = wb.SheetNames;
    const seniorityTabName = sheetNames.find(name => 
      name.toLowerCase().replace(/\s/g, '') === 'schades-dienstjaar' || 
      name.toLowerCase().replace(/\s/g, '') === 'schadesdienstjaar'
    );
    
    let seniorityData: any[] = [];
    if (seniorityTabName) {
      const wsDienstjaar = wb.Sheets[seniorityTabName];
      const rawSeniority = XLSX.utils.sheet_to_json(wsDienstjaar) as any[];
      
      // Normalize keys to "Dienstjaren" and "schades"
      seniorityData = rawSeniority.map(row => {
        const normalized: any = {};
        Object.keys(row).forEach(key => {
          const lowerKey = key.toLowerCase().trim();
          if (lowerKey === 'dienstjaren' || lowerKey === 'dienstjaar') {
            normalized['Dienstjaren'] = row[key];
          } else if (lowerKey === 'schades' || lowerKey === 'schade' || lowerKey === 'aantal') {
            normalized['schades'] = row[key];
          } else {
            normalized[key] = row[key];
          }
        });
        return normalized;
      }).filter(row => row.Dienstjaren !== undefined);
    }
    // Fetch personeelsficheGB.json
    let personnelData = null;
    let personnelStatus = "not_found";
    try {
      const jsonChunks: any[] = [];
      const jsonWritableStream = new Stream.Writable({
        write(chunk, encoding, next) {
          jsonChunks.push(chunk);
          next();
        }
      });
      
      // Try multiple path variations
      const dir = path.includes('/') ? path.substring(0, path.lastIndexOf('/') + 1) : '';
      const fileName = "personeelsficheGB.json";
      const possiblePaths = [
        `${dir}${fileName}`,
        fileName,
        `/${fileName}`
      ];

      let success = false;
      for (const p of possiblePaths) {
        try {
          await client.downloadTo(jsonWritableStream, p);
          success = true;
          break;
        } catch (e) {
          continue;
        }
      }

      if (success) {
        const jsonBuffer = Buffer.concat(jsonChunks);
        personnelData = JSON.parse(jsonBuffer.toString());
        personnelStatus = "success";
      }
    } catch (e: any) {
      console.warn("Could not fetch personeelsficheGB.json:", e);
      personnelStatus = `error: ${e.message}`;
    }

    // Fetch Coachingslijst.xlsx
    let coachingData = { requested: [], completed: [] };
    try {
      const coachingChunks: any[] = [];
      const coachingWritableStream = new Stream.Writable({
        write(chunk, encoding, next) {
          coachingChunks.push(chunk);
          next();
        }
      });
      const dir = path.includes('/') ? path.substring(0, path.lastIndexOf('/') + 1) : '';
      await client.downloadTo(coachingWritableStream, `${dir}Coachingslijst.xlsx`);
      const coachingBuffer = Buffer.concat(coachingChunks);
      const coachingWb = XLSX.read(coachingBuffer, { type: 'buffer', cellDates: true });
      
      const wsRequested = coachingWb.Sheets['Coaching'];
      if (wsRequested) {
        coachingData.requested = XLSX.utils.sheet_to_json(wsRequested);
      }
      
      const wsCompleted = coachingWb.Sheets['Voltooide coachings'];
      if (wsCompleted) {
        coachingData.completed = XLSX.utils.sheet_to_json(wsCompleted);
      }
    } catch (e) {
      console.warn("Could not fetch Coachingslijst.xlsx:", e);
    }

    res.status(200).json({ 
      success: true, 
      data: bronData,
      seniorityData: seniorityData,
      personnelData: personnelData,
      personnelStatus: personnelStatus,
      coachingData: coachingData
    });
  } catch (error: any) {
    console.error("Vercel API Error:", error);
    res.status(500).json({ success: false, error: error.message });
  } finally {
    client.close();
  }
}
