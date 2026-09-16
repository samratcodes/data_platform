const commonPasswords = new Set(["password", "password123", "1234567890", "qwerty123", "letmein123", "welcome123", "admin123456"]);

export function validatePassword(password: string, email?: string) {
  if (password.length < 12 || password.length > 128) return "Choose a password between 12 and 128 characters.";
  const normalized = password.toLowerCase();
  const localPart = email?.split("@")[0]?.toLowerCase() || "";
  if (commonPasswords.has(normalized)) return "Choose a less predictable password.";
  if (localPart.length >= 4 && normalized.includes(localPart)) return "Choose a password that does not contain your email name.";
  if (/(.)\1{7,}/.test(password)) return "Choose a password without long repeated characters.";
  if (!/[a-z]/.test(password) || !/[A-Z]/.test(password) || !/\d/.test(password) || !/[^\p{L}\p{N}]/u.test(password)) {
    return "Use uppercase, lowercase, a number, and a symbol.";
  }
  return null;
}
