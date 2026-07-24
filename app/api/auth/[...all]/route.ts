import { toNextJsHandler } from "better-auth/next-js";
import { auth, ensureAuthReady } from "@/lib/auth";

const handler = toNextJsHandler(auth);

export async function GET(request: Request) {
  await ensureAuthReady();
  return handler.GET(request);
}

export async function POST(request: Request) {
  await ensureAuthReady();
  return handler.POST(request);
}
