import fs from "node:fs";
import path from "node:path";

export default function globalSetup() {
  const database = path.resolve(process.cwd(), "data/qiuzhitai.e2e.db");
  for (const suffix of ["", "-shm", "-wal"]) {
    try {
      fs.unlinkSync(`${database}${suffix}`);
    } catch {}
  }
}
