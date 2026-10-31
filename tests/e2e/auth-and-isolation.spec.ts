import { test, expect } from "@playwright/test";

test("invalid customer login is rejected", async ({ page }) => {
  await page.goto("/customer/login");
  await page.getByLabel("Email").fill("customer@brightloop.demo");
  await page.getByLabel("Password").fill("Wrong@12345");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByText("Incorrect email or password")).toBeVisible();
});

test("customer reaches only the customer portal and cannot read another customer", async ({ page }) => {
  await page.goto("/customer/login");
  await page.getByLabel("Email").fill("customer@brightloop.demo");
  await page.getByLabel("Password").fill("Customer@123");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/portal\/overview/);
  await expect(page.getByText("Customer portal")).toBeVisible();

  await page.goto("/app/overview");
  await expect(page).toHaveURL(/\/portal\/overview/);

  const response = await page.request.get("/api/r/invoices?customerId=cust_002&limit=50");
  expect(response.ok()).toBe(true);
  await expect(response.json()).resolves.toMatchObject({ items: [] });
});
