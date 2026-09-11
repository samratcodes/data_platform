import nextEnv from "@next/env";

const { loadEnvConfig } = nextEnv;
loadEnvConfig(process.cwd());

const apiKey = process.env.RESEND_API_KEY?.trim();
if (!apiKey) throw new Error("Set RESEND_API_KEY before checking email delivery.");
const from = process.env.EMAIL_FROM?.trim();
if (!from) throw new Error("Set EMAIL_FROM before checking email delivery.");

const response = await fetch("https://api.resend.com/domains", {
  headers: { Authorization: `Bearer ${apiKey}` },
  signal: AbortSignal.timeout(15_000),
});
const body = await response.json().catch(() => ({}));
if (!response.ok) throw new Error(String(body.message || `Resend returned ${response.status}`).slice(0, 500));

const domains = Array.isArray(body.data) ? body.data : [];
const verified = domains.filter((domain) => domain.status === "verified");
if (!verified.length) throw new Error("The Resend API key is valid, but no verified sending domain is available.");
const senderDomain = from.match(/@([^>\s]+)/)?.[1]?.toLowerCase();
if (!senderDomain || !verified.some((domain) => domain.name.toLowerCase() === senderDomain)) {
  throw new Error("EMAIL_FROM must use one of the verified Resend sending domains.");
}

console.log(`Resend is connected and ${senderDomain} is ready to send.`);
