import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";

const imageBytes = readFileSync("public/brand-logo.png");
const imageFile = (name: string) => ({ name, mimeType: "image/png", buffer: imageBytes });

async function openEvidenceStep(page: import("@playwright/test").Page) {
  await page.goto("/signup/data-company");
  await page.getByPlaceholder("Your company name").fill("Northstar QA Data");
  await page.getByPlaceholder("What data do you provide, and how is it collected?").fill("We collect quality real-world images and video for AI research teams.");
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.locator(".official-document-picker")).toBeVisible();
}

test("company evidence is reviewable, editable, limited, and mobile-safe", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openEvidenceStep(page);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);

  await page.locator(".office-image-picker input[type=file]").setInputFiles([imageFile("office-a.png"), imageFile("office-b.png")]);
  await expect(page.getByRole("dialog", { name: "Review office images" })).toBeVisible();
  await expect(page.locator(".office-image-review-grid article")).toHaveCount(2);
  await expect(page.locator(".office-image-review-hero img")).toHaveJSProperty("naturalWidth", 1024);
  await page.getByRole("button", { name: /OK.*keep 2 new images/ }).click();
  await expect(page.locator(".office-image-gallery article")).toHaveCount(2);

  await page.locator(".official-document-picker input[type=file]").setInputFiles([imageFile("certificate.png"), imageFile("tax.png")]);
  await expect(page.getByRole("dialog", { name: "Preview certificate.png" })).toBeVisible();
  await page.locator(".official-document-preview footer input").fill("Certificate of incorporation");
  await page.getByRole("button", { name: "Done" }).click();
  await expect(page.locator(".official-document-gallery article")).toHaveCount(2);
  await expect(page.locator(".official-document-gallery article img").first()).toHaveJSProperty("naturalWidth", 1024);
  await page.locator(".official-document-gallery article").nth(1).getByRole("button", { name: /Preview document/ }).click();
  await page.locator(".official-document-preview footer input").fill("Tax certificate");
  await page.getByRole("button", { name: "Done" }).click();
  await expect(page.locator(".official-document-gallery article").nth(0).locator("input")).toHaveValue("Certificate of incorporation");
  await expect(page.locator(".official-document-gallery article").nth(1).locator("input")).toHaveValue("Tax certificate");

  await page.locator(".official-document-picker input[type=file]").setInputFiles([imageFile("address.png"), imageFile("registration.png"), imageFile("license.png")]);
  await page.getByRole("button", { name: "Done" }).click();
  await expect(page.locator(".official-document-gallery article")).toHaveCount(5);
  await expect(page.locator(".official-document-picker input[type=file]")).toBeDisabled();
  await page.locator(".official-document-gallery article").last().getByRole("button", { name: /Delete/ }).click();
  await expect(page.locator(".official-document-gallery article")).toHaveCount(4);
  await expect(page.locator(".official-document-picker input[type=file]")).toBeEnabled();

  await page.locator(".official-document-picker input[type=file]").setInputFiles({ name: "too-large.png", mimeType: "image/png", buffer: Buffer.alloc(10_000_001) });
  await expect(page.locator(".company-wizard-alert")).toContainText("no larger than 10 MB");
  await expect(page.locator(".official-document-gallery article")).toHaveCount(4);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
});

test("official PDF preview is permitted by the page security policy", async ({ page }) => {
  await openEvidenceStep(page);
  const policy = (await page.request.get("/signup/data-company")).headers()["content-security-policy"];
  expect(policy).toContain("frame-src 'self' blob:");
  await page.locator(".official-document-picker input[type=file]").setInputFiles({
    name: "registration.pdf",
    mimeType: "application/pdf",
    buffer: Buffer.from("%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Count 0/Kids[]>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF"),
  });
  await expect(page.getByRole("dialog", { name: "Preview registration.pdf" }).locator("iframe")).toHaveAttribute("src", /^blob:/);
});
