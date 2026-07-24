import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { username } from "better-auth/plugins/username";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { database } from "@/db";
import * as schema from "@/db/schema";

const secret =
  process.env.BETTER_AUTH_SECRET ||
  "qiuzhitai-local-development-secret-change-before-production";

export const authOptions = {
  database: drizzleAdapter(drizzle(database, { schema }), {
    provider: "sqlite",
    schema,
  }),
  secret,
  baseURL: process.env.BETTER_AUTH_URL || "http://localhost:3000",
  emailAndPassword: { enabled: true, minPasswordLength: 8, maxPasswordLength: 64 },
  session: { expiresIn: 60 * 60 * 24 * 7, updateAge: 60 * 60 * 24 },
  plugins: [
    username({
      minUsernameLength: 3,
      maxUsernameLength: 20,
      usernameValidator: (value) =>
        /^[\p{Script=Han}A-Za-z0-9_]{3,20}$/u.test(value),
      usernameNormalization: (value) => value.toLocaleLowerCase("en-US"),
      displayUsernameNormalization: false,
    }),
  ],
};

export const auth = betterAuth(authOptions);
export function ensureAuthReady() {
  return Promise.resolve();
}
