export const usernamePattern = /^[\p{Script=Han}A-Za-z0-9_]{3,20}$/u;
export const passwordPattern =
  /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,64}$/;

export function normalizeUsername(value: string) {
  return value.trim().toLocaleLowerCase("en-US");
}

export function validateQuestion(value: string) {
  const question = value.trim();
  if (question.length < 10 || question.length > 1000) {
    return { ok: false as const, error: "请用 10–1000 字描述你的处境" };
  }
  return { ok: true as const, question };
}
