import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests",
  timeout: 60000,
  expect: { timeout: 15000 },
  fullyParallel: false,
  workers: 1,
  use: { baseURL: process.env.TEST_BASE_URL || "http://localhost:3000", viewport: { width: 1440, height: 900 }, screenshot: "only-on-failure", trace: "retain-on-failure", launchOptions: { args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"] } },
});
