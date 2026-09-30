import { test, type Browser } from "@playwright/test";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { query } from "../lib/db/client";

/*
 * QA sweep: every page for every role at desktop and phone size. Records crashes, console errors,
 * failed API calls, and sideways scrolling, and takes a screenshot of each page. Temporary accounts
 * and sessions are removed afterwards.
 */
type Finding = { role: string; viewport: string; path: string; status: number | null; issues: string[] };
const findings: Finding[] = [];
const viewports = { desktop: { width: 1440, height: 900 }, phone: { width: 390, height: 844 } };
const created: string[] = [];
const sessions: string[] = [];

async function session(userId: string) {
  const token = randomBytes(32).toString("hex");
  const hash = createHash("sha256").update(token).digest("hex");
  await query("INSERT INTO sessions (token_hash, user_id, expires_at) VALUES ($1, $2, $3)", [hash, userId, Date.now() + 3_600_000]);
  sessions.push(hash);
  return token;
}
async function tempUser(role: string) {
  const id = randomUUID();
  await query("INSERT INTO users (id, name, email, password_hash, role, email_verified_at) VALUES ($1, $2, $3, 'test-only', $4, NOW())", [id, `QA ${role}`, `qa-${role}-${Date.now()}@filemarket-test.dev`, role]);
  created.push(id);
  return id;
}

async function sweep(browser: Browser, role: string, token: string | null, paths: string[]) {
  for (const [name, size] of Object.entries(viewports)) {
    const context = await browser.newContext({ viewport: size });
    if (token) await context.addCookies([{ name: "filemarket_session", value: token, url: "http://localhost:3000" }]);
    const page = await context.newPage();
    for (const path of paths) {
      const issues: string[] = [];
      page.removeAllListeners("pageerror"); page.removeAllListeners("console"); page.removeAllListeners("response");
      page.on("pageerror", (error) => issues.push(`pageerror: ${error.message.slice(0, 200)}`));
      page.on("console", (message) => { if (message.type() === "error" && !/favicon|Download the React DevTools/.test(message.text())) issues.push(`console: ${message.text().slice(0, 200)}`); });
      page.on("response", (response) => { if (response.status() >= 500 || (response.url().includes("/api/") && response.status() >= 400 && response.status() !== 401)) issues.push(`http ${response.status()} ${response.url().replace("http://localhost:3000", "").slice(0, 120)}`); });
      let status: number | null = null;
      try {
        const response = await page.goto(path, { waitUntil: "load", timeout: 120_000 });
        status = response?.status() ?? null;
        await page.waitForTimeout(2500);
        const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
        if (overflow > 1) issues.push(`horizontal overflow ${overflow}px`);
        const file = `${role}-${name}-${path.replace(/[^a-z0-9]+/gi, "_").replace(/^_|_$/g, "") || "home"}.png`;
        await page.screenshot({ path: `test-results/qa/${file}`, fullPage: name === "desktop" });
      } catch (error) { issues.push(`navigation: ${(error as Error).message.slice(0, 160)}`); }
      if (status && status >= 400) issues.push(`status ${status}`);
      findings.push({ role, viewport: name, path, status, issues });
    }
    await context.close();
  }
}

// Takes 10–20 minutes, so it only runs on request: QA_SWEEP=1 npx playwright test tests/zz-qa-sweep.spec.ts
test("QA sweep across roles and pages", async ({ browser }) => {
  test.skip(!process.env.QA_SWEEP, "Set QA_SWEEP=1 to run the page sweep.");
  test.setTimeout(3_600_000);
  mkdirSync("test-results/qa", { recursive: true });
  try {
    const email = (address: string) => query<{ id: string }>("SELECT id FROM users WHERE email = $1", [address]).then((result) => result.rows[0]?.id);
    const dataCompany = await email("demo.company@democapturelabs.com");
    const deviceCompany = await email("demo.devices@demoopticssupply.com");
    const product = (await query<{ id: string }>("SELECT id FROM device_products WHERE published ORDER BY created_at LIMIT 1")).rows[0]?.id;
    const ownProduct = deviceCompany ? (await query<{ id: string }>("SELECT id FROM device_products WHERE user_id = $1 LIMIT 1", [deviceCompany])).rows[0]?.id : undefined;
    const companyApp = (await query<{ id: string }>("SELECT id FROM supplier_applications WHERE application_kind = 'company' AND COALESCE(company_focus, 'collection') = 'collection' ORDER BY submitted_at DESC LIMIT 1")).rows[0]?.id;
    const deviceApp = (await query<{ id: string }>("SELECT id FROM supplier_applications WHERE application_kind = 'company' AND company_focus = 'devices' ORDER BY submitted_at DESC LIMIT 1")).rows[0]?.id;
    const facilityApp = (await query<{ id: string }>("SELECT id FROM supplier_applications WHERE application_kind = 'facility' ORDER BY submitted_at DESC LIMIT 1")).rows[0]?.id;
    const facility = (await query<{ id: string }>("SELECT applications.id FROM supplier_applications applications JOIN users ON users.id = applications.user_id WHERE users.email = 'demo.company@democapturelabs.com' AND application_kind = 'facility' LIMIT 1")).rows[0]?.id;

    await sweep(browser, "visitor", null, ["/", "/login", "/signup", "/signup/data-company", "/signup/data-buyer", "/forgot-password"]);
    await sweep(browser, "buyer", await session(await tempUser("buyer")), ["/map", "/dashboard", "/devices", ...(product ? [`/devices/${product}`] : []), "/operators/demo-capture-labs", "/operators/demo-optics-supply", "/settings"]);
    if (dataCompany) await sweep(browser, "datacompany", await session(dataCompany), ["/supplier", "/supplier/facilities", "/supplier/facilities/new", ...(facility ? [`/supplier/facilities/${facility}`, `/supplier/facilities/${facility}/edit`] : []), "/onboarding", "/settings", "/devices", "/map"]);
    if (deviceCompany) await sweep(browser, "devicecompany", await session(deviceCompany), ["/supplier", "/supplier/products", "/supplier/products/new", ...(ownProduct ? [`/supplier/products/${ownProduct}/edit`] : []), "/onboarding", "/settings", "/devices", "/map"]);
    await sweep(browser, "newcompany", await session(await tempUser("supplier")), ["/supplier", "/onboarding", "/settings", "/supplier/facilities", "/devices"]);
    await sweep(browser, "admin", await session(await tempUser("admin")), ["/admin", "/admin/companies", "/admin/companies?view=incomplete", "/admin/companies/new", "/admin/device-companies", "/admin/device-companies?view=incomplete", "/admin/device-companies?view=devices", "/admin/device-companies/new", "/admin/facilities", "/admin/leads", "/admin/activity", ...[companyApp, deviceApp, facilityApp].filter(Boolean).map((id) => `/admin/applications/${id}`), "/map"]);
  } finally {
    for (const hash of sessions) await query("DELETE FROM sessions WHERE token_hash = $1", [hash]);
    await query("DELETE FROM users WHERE id = ANY($1)", [created]);
    const problems = findings.filter((finding) => finding.issues.length);
    writeFileSync("test-results/qa/report.json", JSON.stringify({ pages: findings.length, problems }, null, 2));
    console.log(`QA: ${findings.length} page views, ${problems.length} with issues`);
    for (const problem of problems) console.log(`${problem.role} ${problem.viewport} ${problem.path}\n  ${problem.issues.join("\n  ")}`);
  }
});
