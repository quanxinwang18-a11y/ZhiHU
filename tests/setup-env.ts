import fs from "node:fs";
import path from "node:path";

const testDb = path.resolve(process.cwd(), "data/qiuzhitai.test.db");
process.env.DATABASE_URL = `file:${testDb}`;
process.env.MOCK_AI = "true";
process.env.BETTER_AUTH_SECRET = "qiuzhitai-test-secret-at-least-thirty-two-characters";

const testGlobal = globalThis as typeof globalThis & {
  qiuzhitaiTestDbInitialized?: boolean;
};
if (!testGlobal.qiuzhitaiTestDbInitialized) {
  for (const suffix of ["", "-shm", "-wal"]) {
    try {
      fs.unlinkSync(`${testDb}${suffix}`);
    } catch {}
  }
  testGlobal.qiuzhitaiTestDbInitialized = true;
}
