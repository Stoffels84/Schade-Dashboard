import * as ftp from "basic-ftp";
import { Stream } from "stream";

export default async function handler(req: any, res: any) {
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
}
