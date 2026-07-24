import { hashPassword } from "better-auth/crypto";
import { database } from "../db/index";
import { ensureAuthReady } from "../lib/auth";

const [username, newPassword] = process.argv.slice(2);
if (!username || !newPassword) {
  console.error("用法：pnpm user:reset-password <用户名> <新密码>");
  process.exit(1);
}
if (!/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,64}$/.test(newPassword)) {
  console.error("新密码需含大写、小写、数字和特殊字符，长度 8–64 位");
  process.exit(1);
}
await ensureAuthReady();
const user = database
  .prepare("SELECT id FROM user WHERE username = ?")
  .get(username) as { id: string } | undefined;
if (!user) {
  console.error(`用户不存在：${username}`);
  process.exit(1);
}
const password = await hashPassword(newPassword);
database
  .prepare(
    "UPDATE account SET password = ?, updatedAt = ? WHERE userId = ? AND providerId = 'credential'",
  )
  .run(password, Date.now(), user.id);
console.log(`已重置用户 ${username} 的本地密码。`);
