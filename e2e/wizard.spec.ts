/**
 * E2E tests — QuickStartWizard
 *
 * Strategy: inject a fake Supabase session via localStorage before each test
 * so the app considers the user authenticated and renders the main UI.
 * Supabase network calls are intercepted and stubbed to prevent real I/O.
 */

import { test, expect, type Page } from "@playwright/test";

// ── Constants ─────────────────────────────────────────────────────────────────

const SUPABASE_URL = "https://mlwvccubpvvajsdxrljj.supabase.co";
const LS_AUTH_KEY = "sb-mlwvccubpvvajsdxrljj-auth-token";

const MOCK_USER = {
  id: "00000000-0000-0000-0000-000000000001",
  aud: "authenticated",
  role: "authenticated",
  email: "test@botforge.dev",
  email_confirmed_at: "2024-01-01T00:00:00.000Z",
  app_metadata: { provider: "email" },
  user_metadata: {},
  created_at: "2024-01-01T00:00:00.000Z",
  updated_at: "2024-01-01T00:00:00.000Z",
};

const MOCK_SESSION = {
  access_token: "mock-access-token",
  token_type: "bearer",
  expires_in: 3600,
  expires_at: Math.floor(Date.now() / 1000) + 3600,
  refresh_token: "mock-refresh-token",
  user: MOCK_USER,
};

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Inject fake session and stub Supabase network before the page loads. */
async function setupAuth(page: Page) {
  // Intercept Supabase auth/v1 requests
  await page.route(`${SUPABASE_URL}/auth/v1/**`, async (route, request) => {
    const url = request.url();
    if (url.includes("/token") || url.includes("/session")) {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(MOCK_SESSION),
      });
    } else if (url.includes("/user")) {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(MOCK_USER),
      });
    } else {
      await route.fulfill({ status: 200, contentType: "application/json", body: "{}" });
    }
  });

  // Stub Supabase REST API (agents table, functions, storage)
  await page.route(`${SUPABASE_URL}/rest/v1/**`, async (route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: "[]" });
  });
  await page.route(`${SUPABASE_URL}/functions/**`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ content: "Mock bot reply." }),
    });
  });
  await page.route(`${SUPABASE_URL}/storage/**`, async (route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: "{}" });
  });

  // Inject localStorage session before the page script runs
  await page.addInitScript(
    ({ key, session }) => {
      localStorage.setItem(key, JSON.stringify(session));
    },
    { key: LS_AUTH_KEY, session: MOCK_SESSION }
  );
}

/** Clear the wizard draft from localStorage before navigating. */
async function clearDraft(page: Page) {
  await page.addInitScript(() => {
    localStorage.removeItem("quickwizard_draft");
  });
}

/** Inject a wizard draft into localStorage before navigating. */
async function injectDraft(page: Page, draft: Record<string, unknown>) {
  await page.addInitScript(
    ({ draft }) => {
      localStorage.setItem("quickwizard_draft", JSON.stringify(draft));
    },
    { draft }
  );
}

/** Navigate to the home page and click "Quick Start" to open the wizard. */
async function openWizard(page: Page) {
  await page.goto("/");
  // Wait for the mode-selection landing to appear, then click Quick Start
  const quickStartBtn = page.getByRole("button", { name: /quick.start/i });
  await quickStartBtn.waitFor({ timeout: 10_000 });
  await quickStartBtn.click();
}

// ─────────────────────────────────────────────────────────────────────────────
// Auth redirect (no session)
// ─────────────────────────────────────────────────────────────────────────────

test.describe("Auth redirect", () => {
  test("unauthenticated user is redirected to /auth", async ({ page }) => {
    // No auth setup — Supabase will return no session
    await page.route(`${SUPABASE_URL}/auth/v1/**`, (route) =>
      route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ data: { session: null }, error: null }) })
    );
    await page.goto("/");
    await expect(page).toHaveURL(/\/auth/, { timeout: 10_000 });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Landing page (authenticated)
// ─────────────────────────────────────────────────────────────────────────────

test.describe("Landing page — authenticated", () => {
  test.beforeEach(async ({ page }) => {
    await setupAuth(page);
    await clearDraft(page);
  });

  test("shows the landing mode-selection page at /", async ({ page }) => {
    await page.goto("/");
    // Should NOT redirect to /auth
    await expect(page).not.toHaveURL(/\/auth/);
    // Quick Start button visible
    await expect(page.getByRole("button", { name: /quick.start/i })).toBeVisible({ timeout: 10_000 });
  });

  test("clicking Quick Start opens the wizard (Step 1)", async ({ page }) => {
    await openWizard(page);
    // Wizard header shows "Describe Your Bot" (en) or "Опишите вашего бота" (ru)
    await expect(
      page.getByText(/Describe Your Bot|Опишите вашего бота/i)
    ).toBeVisible({ timeout: 8_000 });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Step 1 — Describe
// ─────────────────────────────────────────────────────────────────────────────

test.describe("Wizard Step 1 — Describe", () => {
  test.beforeEach(async ({ page }) => {
    await setupAuth(page);
    await clearDraft(page);
    await openWizard(page);
  });

  test("renders description textarea", async ({ page }) => {
    await expect(page.getByRole("textbox").first()).toBeVisible();
  });

  test("Generate AI Brain button is disabled when description is empty", async ({ page }) => {
    const btn = page.getByRole("button", { name: /Generate AI Brain|Сгенерировать мозг/i });
    await expect(btn).toBeDisabled();
  });

  test("Generate AI Brain button becomes enabled after typing a description", async ({ page }) => {
    const textarea = page.getByPlaceholder(/e\.g\.,|напр\./i).first();
    await textarea.fill("I sell handmade candles. Each candle costs $15. Free shipping over $50.");
    const btn = page.getByRole("button", { name: /Generate AI Brain|Сгенерировать мозг/i });
    await expect(btn).toBeEnabled();
  });

  test("Back button is disabled on the first step", async ({ page }) => {
    const backBtn = page.getByRole("button", { name: /Back|Назад/i });
    await expect(backBtn).toBeDisabled();
  });

  test("step counter shows '1 / 5'", async ({ page }) => {
    await expect(page.getByText(/1.*\/.*5/)).toBeVisible();
  });

  test("tone selector is visible and defaults to Friendly", async ({ page }) => {
    // Select trigger for tone contains "Friendly"
    await expect(page.getByText("Friendly")).toBeVisible();
  });

  test("bot name input accepts text", async ({ page }) => {
    const botNameInput = page.getByPlaceholder(/Flora Assistant|Флора Ассистент/i);
    await botNameInput.fill("Candle Bot");
    await expect(botNameInput).toHaveValue("Candle Bot");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// localStorage persistence
// ─────────────────────────────────────────────────────────────────────────────

test.describe("Wizard — localStorage state persistence", () => {
  test("wizard saves description to localStorage as user types", async ({ page }) => {
    await setupAuth(page);
    await clearDraft(page);
    await openWizard(page);

    const textarea = page.getByPlaceholder(/e\.g\.,|напр\./i).first();
    await textarea.fill("I run a bakery downtown, open 8am-6pm weekdays.");

    // Give the debounced effect time to flush
    await page.waitForTimeout(500);

    const draft = await page.evaluate(() => {
      const raw = localStorage.getItem("quickwizard_draft");
      return raw ? JSON.parse(raw) : null;
    });

    expect(draft).not.toBeNull();
    expect(draft.botDescription).toContain("I run a bakery");
  });

  test("wizard restores description from localStorage on reload", async ({ page }) => {
    await setupAuth(page);
    await injectDraft(page, {
      botDescription: "I sell vintage vinyl records online.",
      botName: "Vinyl Bot",
      tone: "Friendly",
      responseStyle: "Concise",
      step: "describe",
    });
    await openWizard(page);

    // The restored description should appear in the textarea
    await expect(
      page.getByText("I sell vintage vinyl records online.")
    ).toBeVisible({ timeout: 5_000 });
  });

  test("wizard restores bot name from localStorage on reload", async ({ page }) => {
    await setupAuth(page);
    await injectDraft(page, {
      botDescription: "Some description here",
      botName: "VinylBot",
      step: "describe",
    });
    await openWizard(page);

    const botNameInput = page.getByPlaceholder(/Flora Assistant|Флора Ассистент/i);
    await expect(botNameInput).toHaveValue("VinylBot");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Step restoration — navigate to later steps via injected draft
// ─────────────────────────────────────────────────────────────────────────────

test.describe("Wizard — step restoration from draft", () => {
  test("restores to brain_preview step and shows Brain Ready heading", async ({ page }) => {
    await setupAuth(page);
    await injectDraft(page, {
      botDescription: "A candle shop bot",
      botName: "Flora",
      tone: "Friendly",
      responseStyle: "Concise",
      generatedBrain: "You are Flora, a helpful candle shop assistant.",
      brainGenerated: true,
      step: "brain_preview",
    });
    await openWizard(page);

    await expect(
      page.getByText(/Bot Brain Ready|Мозг бота готов/i)
    ).toBeVisible({ timeout: 5_000 });
  });

  test("restores to identity step and shows Bot Identity heading", async ({ page }) => {
    await setupAuth(page);
    await injectDraft(page, {
      botDescription: "A support bot",
      botName: "HelpBot",
      generatedBrain: "You are HelpBot, a support assistant.",
      brainGenerated: true,
      step: "identity",
      wizardData: {
        bot_name: "HelpBot",
        short_description: "",
      },
    });
    await openWizard(page);

    await expect(
      page.getByText(/Bot Identity|Идентичность бота/i)
    ).toBeVisible({ timeout: 5_000 });
  });

  test("restores to api_key step and shows Connect AI Brain heading", async ({ page }) => {
    await setupAuth(page);
    await injectDraft(page, {
      botDescription: "An order bot",
      generatedBrain: "System prompt here for the bot.",
      brainGenerated: true,
      step: "api_key",
      wizardData: { bot_name: "OrderBot", short_description: "Order processing bot" },
    });
    await openWizard(page);

    await expect(
      page.getByText(/Connect AI Brain|Подключите AI-мозг/i)
    ).toBeVisible({ timeout: 5_000 });
  });

  test("restores to deploy step and shows Deploy to Telegram heading", async ({ page }) => {
    await setupAuth(page);
    await injectDraft(page, {
      botDescription: "A sales bot",
      generatedBrain: "You are a sales assistant.",
      brainGenerated: true,
      step: "deploy",
      wizardData: {
        bot_name: "SalesBot",
        short_description: "Sells products",
        telegram_bot_token: "",
        telegram_display_name: "",
        telegram_short_description: "",
        telegram_about_text: "",
        telegram_commands: [],
        openai_api_key: "",
      },
    });
    await openWizard(page);

    await expect(
      page.getByText(/Deploy to Telegram|Деплой в Telegram/i)
    ).toBeVisible({ timeout: 5_000 });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Step 3 — Identity
// ─────────────────────────────────────────────────────────────────────────────

test.describe("Wizard Step 3 — Identity", () => {
  test.beforeEach(async ({ page }) => {
    await setupAuth(page);
    await injectDraft(page, {
      botDescription: "A candle shop bot",
      botName: "Flora",
      generatedBrain: "You are Flora, a candle shop assistant.",
      brainGenerated: true,
      step: "identity",
      wizardData: { bot_name: "Flora", short_description: "" },
    });
    await openWizard(page);
    // Wait for identity step
    await page.getByText(/Bot Identity|Идентичность бота/i).waitFor({ timeout: 5_000 });
  });

  test("Next button disabled when short_description is empty", async ({ page }) => {
    const nextBtn = page.getByRole("button", { name: /Next|Далее/i });
    await expect(nextBtn).toBeDisabled();
  });

  test("Next button enabled after filling short_description", async ({ page }) => {
    const descTextarea = page.getByPlaceholder(/Describe your bot in one sentence|Опишите бота/i);
    await descTextarea.fill("A bot that helps customers buy candles online.");
    const nextBtn = page.getByRole("button", { name: /Next|Далее/i });
    await expect(nextBtn).toBeEnabled();
  });

  test("welcome message textarea is visible", async ({ page }) => {
    const welcomeTextarea = page.getByPlaceholder(/First message after \/start|Первое сообщение/i);
    await expect(welcomeTextarea).toBeVisible();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Step 4 — API Key (optional)
// ─────────────────────────────────────────────────────────────────────────────

test.describe("Wizard Step 4 — API Key", () => {
  test.beforeEach(async ({ page }) => {
    await setupAuth(page);
    await injectDraft(page, {
      botDescription: "A candle shop bot",
      generatedBrain: "You are a candle shop assistant.",
      brainGenerated: true,
      step: "api_key",
      wizardData: { bot_name: "Flora", short_description: "Candle shop" },
    });
    await openWizard(page);
    await page.getByText(/Connect AI Brain|Подключите AI-мозг/i).waitFor({ timeout: 5_000 });
  });

  test("Next button is enabled even without an API key (step is optional)", async ({ page }) => {
    const nextBtn = page.getByRole("button", { name: /Next|Далее/i });
    await expect(nextBtn).toBeEnabled();
  });

  test("API key input renders with password type", async ({ page }) => {
    const input = page.getByPlaceholder("sk-...");
    await expect(input).toBeVisible();
    await expect(input).toHaveAttribute("type", "password");
  });

  test("shows validation warning when key doesn't start with sk-", async ({ page }) => {
    const input = page.getByPlaceholder("sk-...");
    await input.fill("invalid-key-format");
    await expect(page.getByText(/must start with sk-|должен начинаться с sk-/i)).toBeVisible();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Step 5 — Deploy
// ─────────────────────────────────────────────────────────────────────────────

test.describe("Wizard Step 5 — Deploy", () => {
  test.beforeEach(async ({ page }) => {
    await setupAuth(page);
    await injectDraft(page, {
      botDescription: "A candle shop bot",
      generatedBrain: "You are a candle shop assistant.",
      brainGenerated: true,
      step: "deploy",
      wizardData: {
        bot_name: "Flora",
        short_description: "Candle shop bot",
        telegram_bot_token: "",
        telegram_display_name: "",
        telegram_short_description: "",
        telegram_about_text: "",
        telegram_commands: [],
        openai_api_key: "",
      },
    });
    await openWizard(page);
    await page.getByText(/Deploy to Telegram|Деплой в Telegram/i).waitFor({ timeout: 5_000 });
  });

  test("Deploy button is disabled without a valid token", async ({ page }) => {
    const deployBtn = page.getByRole("button", { name: /Deploy to Telegram|Развернуть в Telegram/i });
    await expect(deployBtn).toBeDisabled();
  });

  test("Bot Token input is visible", async ({ page }) => {
    await expect(
      page.getByPlaceholder("123456789:ABC-DEF1234ghIkl-zyx57W2v1u123ew11")
    ).toBeVisible();
  });

  test("entering a token with invalid format shows an error indicator", async ({ page }) => {
    const tokenInput = page.getByPlaceholder("123456789:ABC-DEF1234ghIkl-zyx57W2v1u123ew11");
    // Invalid format: not matching /^\d{8,12}:[A-Za-z0-9_-]{30,}$/
    await tokenInput.fill("badtoken");
    // Error message or XCircle indicator should appear
    await expect(
      page.getByText(/Invalid token format|Неверный формат токена/i)
    ).toBeVisible({ timeout: 3_000 });
  });

  test("token input is password type (masked)", async ({ page }) => {
    const tokenInput = page.getByPlaceholder("123456789:ABC-DEF1234ghIkl-zyx57W2v1u123ew11");
    await expect(tokenInput).toHaveAttribute("type", "password");
  });

  test("summary card shows bot name from wizard data", async ({ page }) => {
    await expect(page.getByText("Flora")).toBeVisible();
  });

  test("step counter shows '5 / 5'", async ({ page }) => {
    await expect(page.getByText(/5.*\/.*5/)).toBeVisible();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Step navigation
// ─────────────────────────────────────────────────────────────────────────────

test.describe("Wizard — step navigation", () => {
  test("Back button from brain_preview returns to describe step", async ({ page }) => {
    await setupAuth(page);
    await injectDraft(page, {
      botDescription: "A booking bot",
      generatedBrain: "You are a booking assistant.",
      brainGenerated: true,
      step: "brain_preview",
    });
    await openWizard(page);
    await page.getByText(/Bot Brain Ready|Мозг бота готов/i).waitFor({ timeout: 5_000 });

    const backBtn = page.getByRole("button", { name: /Back|Назад/i });
    await expect(backBtn).toBeEnabled();
    await backBtn.click();

    await expect(
      page.getByText(/Describe Your Bot|Опишите вашего бота/i)
    ).toBeVisible({ timeout: 5_000 });
  });

  test("Next button from api_key advances to deploy step", async ({ page }) => {
    await setupAuth(page);
    await injectDraft(page, {
      botDescription: "A booking bot",
      generatedBrain: "You are a booking assistant.",
      brainGenerated: true,
      step: "api_key",
      wizardData: { bot_name: "BookBot", short_description: "Booking bot" },
    });
    await openWizard(page);
    await page.getByText(/Connect AI Brain|Подключите AI-мозг/i).waitFor({ timeout: 5_000 });

    const nextBtn = page.getByRole("button", { name: /Next|Далее/i });
    await nextBtn.click();

    await expect(
      page.getByText(/Deploy to Telegram|Деплой в Telegram/i)
    ).toBeVisible({ timeout: 5_000 });
  });

  test("completed step indicators are clickable to navigate back", async ({ page }) => {
    await setupAuth(page);
    await injectDraft(page, {
      botDescription: "A lead generation bot",
      generatedBrain: "You are a lead gen assistant.",
      brainGenerated: true,
      step: "identity",
      wizardData: { bot_name: "LeadBot", short_description: "Leads" },
    });
    await openWizard(page);
    await page.getByText(/Bot Identity|Идентичность бота/i).waitFor({ timeout: 5_000 });

    // Click step indicator circle #1 (already completed)
    const stepCircles = page.locator(".rounded-full").filter({ hasText: "" });
    // The first step indicator (index 0) should be a check mark and clickable
    const firstStepBtn = page
      .locator("button.rounded-full")
      .first();
    await firstStepBtn.click();

    await expect(
      page.getByText(/Describe Your Bot|Опишите вашего бота/i)
    ).toBeVisible({ timeout: 5_000 });
  });
});
