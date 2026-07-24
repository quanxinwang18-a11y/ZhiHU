import { ensureBusinessSchema } from "../db/index";
import { ensureAuthReady } from "../lib/auth";

ensureBusinessSchema();
await ensureAuthReady();
console.log("求知台本地数据库已就绪：data/qiuzhitai.db");
