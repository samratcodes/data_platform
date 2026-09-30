import { test, expect } from "@playwright/test";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { query } from "../lib/db/client";

/** A verified buyer with a live session, created directly so the test does not depend on the signup form. */
async function signInBuyer(page: import("@playwright/test").Page) {
  const id = randomUUID();
  const token = randomBytes(32).toString("hex");
  await query("INSERT INTO users (id, name, email, password_hash, role, email_verified_at) VALUES ($1, 'Shop Tester', $2, 'test-only', 'buyer', NOW())", [id, `shop-${Date.now()}@filemarket-test.dev`]);
  await query("INSERT INTO sessions (token_hash, user_id, expires_at) VALUES ($1, $2, $3)", [createHash("sha256").update(token).digest("hex"), id, Date.now() + 3_600_000]);
  await page.context().addCookies([{ name: "filemarket_session", value: token, url: "http://localhost:3000" }]);
  return id;
}

test("device marketplace works as a shop with filters", async ({ page }) => {
  test.setTimeout(120000);
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  const userId = await signInBuyer(page);
  test.info().attach("user", { body: userId });
  await page.goto("/devices");
  await expect(page.getByRole("heading", { name: "Devices for data collection" })).toBeVisible();
  await expect(page.locator(".desk-ledger-item")).toHaveCount(4);

  const cards = page.locator(".shop-grid .product-card");
  const total = await cards.count();
  if (total > 0) {
    await expect(page.getByRole("complementary", { name: "Filters" })).toBeVisible();
    // Ticking a filter narrows the grid to its count and adds a removable chip.
    const first = page.locator(".shop-facet").first().locator("label").first();
    const expected = Number(await first.locator("small").textContent());
    await first.locator("input").check();
    await expect(cards).toHaveCount(expected);
    await expect(page.locator(".shop-chips button").first()).toBeVisible();
    await page.locator(".shop-chips .is-clear").click();
    await expect(cards).toHaveCount(total);

    await page.getByRole("textbox", { name: "Search devices" }).fill("zzzz-no-such-device");
    await expect(page.getByText("No devices match")).toBeVisible();
    await page.getByRole("button", { name: "Clear all filters" }).click();
    await expect(cards).toHaveCount(total);
  }
  await page.screenshot({ path: "test-results/device-shop-desktop.png", fullPage: true });

  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: "test-results/device-shop-mobile.png" });
  if (total > 0) {
    await page.locator(".shop-filter-button").click();
    await expect(page.locator(".shop-filters.is-open")).toBeVisible();
    await page.waitForTimeout(400);
    await page.screenshot({ path: "test-results/device-shop-mobile-filters.png" });
    await page.keyboard.press("Escape");
    await expect(page.locator(".shop-filters.is-open")).toHaveCount(0);
  }
  expect(errors).toEqual([]);
  await query("DELETE FROM users WHERE id = $1", [userId]);
});
