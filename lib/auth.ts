import { betterAuth } from "better-auth";
import { getMigrations } from "better-auth/db/migration";
import { username } from "better-auth/plugins/username";
import { database } from "@/db";

const secret =
  process.env.BETTER_AUTH_SECRET ||
  "qiuzhitai-local-development-secret-change-before-production";

export const authOptions = {
  database,
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
      usernameNormalization: false,
      displayUsernameNormalization: false,
    }),
  ],
};

export const auth = betterAuth(authOptions);
let authReady: Promise<void> | undefined;

export function ensureAuthReady() {
  if (!authReady) {
    authReady = getMigrations(authOptions).then(({ runMigrations }) =>
      runMigrations(),
    );
  }
  return authReady;
}
