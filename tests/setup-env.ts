import fs from "node:fs";
import path from "node:path";

const testDb = path.resolve(process.cwd(), "data/qiuzhitai.test.db");
process.env.DATABASE_URL = `file:${testDb}`;
process.env.MOCK_AI = "true";
process.env.BETTER_AUTH_SECRET = "qiuzhitai-test-secret-at-least-thirty-two-characters";

try {
  fs.unlinkSync(testDb);
} catch {}
