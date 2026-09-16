import { synchronizeGoogleSheets } from "@/lib/integrations/google-sheets";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return Response.json({ error: "Cron sync is not configured." }, { status: 503 });
  if (request.headers.get("authorization") !== `Bearer ${secret}`) return Response.json({ error: "Unauthorized." }, { status: 401 });
  try { const worksheets = await synchronizeGoogleSheets(); return Response.json({ synchronizedAt: new Date().toISOString(), worksheets }, { headers: { "Cache-Control": "no-store" } }); }
  catch (error) { console.error("Google Sheets cron synchronization failed", error); return Response.json({ error: "Google Sheets synchronization failed." }, { status: 500 }); }
}
