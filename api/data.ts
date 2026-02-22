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

    // Track file statuses
    const fileStatuses: Record<string, { status: 'success' | 'error' | 'not_found', message?: string }> = {};

    // Fetch BRON data (Main file)
    let bronData: any[] = [];
    let seniorityData: any[] = [];
    try {
      await client.downloadTo(writableStream, path);
      const buffer = Buffer.concat(chunks);
      const wb = XLSX.read(buffer, { type: 'buffer', cellDates: true });
      
      const wsBron = wb.Sheets['BRON'];
      if (!wsBron) {
        throw new Error('Tabblad "BRON" niet gevonden');
      }
      bronData = XLSX.utils.sheet_to_json(wsBron) as any[];

      const sheetNames = wb.SheetNames;
      const seniorityTabName = sheetNames.find(name => 
        name.toLowerCase().replace(/\s/g, '') === 'schades-dienstjaar' || 
        name.toLowerCase().replace(/\s/g, '') === 'schadesdienstjaar'
      );
      
      if (seniorityTabName) {
        const wsDienstjaar = wb.Sheets[seniorityTabName];
        const rawSeniority = XLSX.utils.sheet_to_json(wsDienstjaar) as any[];
        seniorityData = rawSeniority.map(row => {
          const normalized: any = {};
          Object.keys(row).forEach(key => {
            const lowerKey = key.toLowerCase().trim();
            if (lowerKey === 'dienstjaren' || lowerKey === 'dienstjaar') normalized['Dienstjaren'] = row[key];
            else if (lowerKey === 'schades' || lowerKey === 'schade' || lowerKey === 'aantal') normalized['schades'] = row[key];
            else normalized[key] = row[key];
          });
          return normalized;
        }).filter(row => row.Dienstjaren !== undefined);
      }
      fileStatuses[path] = { status: 'success' };
    } catch (e: any) {
      fileStatuses[path] = { status: 'error', message: e.message };
    }

    // Fetch personeelsficheGB.json
    let personnelData = null;
    try {
      const jsonChunks: any[] = [];
      const jsonWritableStream = new Stream.Writable({
        write(chunk, encoding, next) { jsonChunks.push(chunk); next(); }
      });
      const dir = path.includes('/') ? path.substring(0, path.lastIndexOf('/') + 1) : '';
      const fileName = "personeelsficheGB.json";
      await client.downloadTo(jsonWritableStream, `${dir}${fileName}`);
      const jsonBuffer = Buffer.concat(jsonChunks);
      personnelData = JSON.parse(jsonBuffer.toString());
      fileStatuses[fileName] = { status: 'success' };
    } catch (e: any) {
      fileStatuses["personeelsficheGB.json"] = { status: 'not_found', message: e.message };
    }

    // Fetch Coachingslijst.xlsx
    let coachingData = { requested: [], completed: [] };
    try {
      const coachingChunks: any[] = [];
      const coachingWritableStream = new Stream.Writable({
        write(chunk, encoding, next) { coachingChunks.push(chunk); next(); }
      });
      const dir = path.includes('/') ? path.substring(0, path.lastIndexOf('/') + 1) : '';
      const coachingFile = "Coachingslijst.xlsx";
      await client.downloadTo(coachingWritableStream, `${dir}${coachingFile}`);
      const coachingBuffer = Buffer.concat(coachingChunks);
      const coachingWb = XLSX.read(coachingBuffer, { type: 'buffer', cellDates: true });
      
      const wsRequested = coachingWb.Sheets['Coaching'];
      if (wsRequested) coachingData.requested = XLSX.utils.sheet_to_json(wsRequested);
      
      const wsCompleted = coachingWb.Sheets['Voltooide coachings'];
      if (wsCompleted) coachingData.completed = XLSX.utils.sheet_to_json(wsCompleted);
      
      fileStatuses[coachingFile] = { status: 'success' };
    } catch (e: any) {
      fileStatuses["Coachingslijst.xlsx"] = { status: 'not_found', message: e.message };
    }

    // Fetch toegestaan_gebruik.xlsx
    let allowedUsers: any[] = [];
    try {
      const authChunks: any[] = [];
      const authWritableStream = new Stream.Writable({
        write(chunk, encoding, next) { authChunks.push(chunk); next(); }
      });
      const dir = path.includes('/') ? path.substring(0, path.lastIndexOf('/') + 1) : '';
      const authFile = "toegestaan_gebruik.xlsx";
      await client.downloadTo(authWritableStream, `${dir}${authFile}`);
      const authBuffer = Buffer.concat(authChunks);
      const authWb = XLSX.read(authBuffer, { type: 'buffer', cellDates: true });
      const wsAuth = authWb.Sheets[authWb.SheetNames[0]];
      if (wsAuth) {
        allowedUsers = XLSX.utils.sheet_to_json(wsAuth);
      }
      fileStatuses[authFile] = { status: 'success' };
    } catch (e: any) {
      fileStatuses["toegestaan_gebruik.xlsx"] = { status: 'not_found', message: e.message };
    }

    // Fetch Overzicht gesprekken (aangepast).xlsx
    let conversationsData: any[] = [];
    try {
      const convChunks: any[] = [];
      const convWritableStream = new Stream.Writable({
        write(chunk, encoding, next) { convChunks.push(chunk); next(); }
      });
      const dir = path.includes('/') ? path.substring(0, path.lastIndexOf('/') + 1) : '';
      const convFile = "Overzicht gesprekken (aangepast).xlsx";
      // Try both .xlsx and .xslx just in case
      try {
        await client.downloadTo(convWritableStream, `${dir}${convFile}`);
      } catch (e) {
        await client.downloadTo(convWritableStream, `${dir}Overzicht gesprekken (aangepast).xslx`);
      }
      const convBuffer = Buffer.concat(convChunks);
      const convWb = XLSX.read(convBuffer, { type: 'buffer', cellDates: true });
      const wsConv = convWb.Sheets[convWb.SheetNames[0]];
      if (wsConv) {
        conversationsData = XLSX.utils.sheet_to_json(wsConv);
      }
      fileStatuses[convFile] = { status: 'success' };
    } catch (e: any) {
      fileStatuses["Overzicht gesprekken (aangepast).xlsx"] = { status: 'not_found', message: e.message };
    }

    res.status(200).json({ 
      success: true, 
      data: bronData,
      seniorityData: seniorityData,
      personnelData: personnelData,
      coachingData: coachingData,
      allowedUsers: allowedUsers,
      conversationsData: conversationsData,
      fileStatuses: fileStatuses
    });
  } catch (error: any) {
    console.error("Vercel API Error:", error);
    res.status(500).json({ success: false, error: error.message });
  } finally {
    client.close();
  }
}
