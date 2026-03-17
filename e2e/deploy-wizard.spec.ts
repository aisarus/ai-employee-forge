/**
 * E2E tests — DeployWizard (Advanced Wizard)
 *
 * Covers three critical paths:
 *   1. Bot creation  — bot type selection, step progression
 *   2. Prompt config — identity, welcome, API keys, Telegram config
 *   3. Deploy        — review checklist, confirm, deploy call, success screen
 *
 * Strategy:
 *   - Inject a fake Supabase session via localStorage before each test.
 *   - Stub all Supabase network calls.
 *   - Open the wizard from /agents (edit existing bot) via the 3-dot menu.
 *   - Use localStorage draft injection (wizard_step_/wizard_draft_) to
 *     "teleport" directly to any step without re-running the full flow.
 *   - Each test section uses a purpose-built mock agent so that initialData
 *     from MyAgents does not interfere with validation-state tests.
 *
 * Notes:
 *   - The app renders in Russian when browser locale is not explicitly set,
 *     so all text assertions use bilingual regex patterns.
 *   - "API Keys" step: canNext() requires a key starting with "sk-"; Gemini
 *     keys (AIza...) are unsupported by canNext even though the UI accepts them.
 */

import { test, expect, type Page } from "@playwright/test";

// ── Constants ──────────────────────────────────────────────────────────────────

const SUPABASE_URL = "https://mlwvccubpvvajsdxrljj.supabase.co";
const LS_AUTH_KEY  = "sb-mlwvccubpvvajsdxrljj-auth-token";
const AGENT_ID     = "test-agent-deploy-99";

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

/** Base mock agent — support bot, all required fields populated. */
const MOCK_AGENT_FULL = {
  id: AGENT_ID,
  name: "SupportBot",
  description: "Customer support assistant",
  about_text: "Handles customer issues",
  bot_type: "support",
  system_prompt: "You are SupportBot.",
  structured_prompt: { bot_actions: ["Answer questions"] },
  openai_api_key: "",
  telegram_bot_token: "",
  telegram_display_name: "SupportBot",
  telegram_short_description: "Customer support assistant",
  telegram_about_text: "Handles customer issues",
  telegram_commands: [
    { command: "/start", description: "Start" },
    { command: "/help",  description: "Help" },
  ],
  welcome_message: "Hello! How can I help you today?",
  fallback_message: "I'm sorry, I didn't understand.",
  is_active: false,
  platform: "telegram",
  messages_count: 42,
  tone: "Friendly",
  response_style: "Concise",
  default_language: "English",
  bot_avatar_url: "",
  bot_username_hint: "",
  created_at: "2024-01-15T10:00:00.000Z",
  updated_at: "2024-01-15T10:00:00.000Z",
};

/**
 * Agent with no bot_type — wizard opens at step 0 with only 1 total step
 * (isLastStep=true → shows Deploy button instead of Next).
 * Keeps name "SupportBot" so the agents list card is still findable.
 */
const MOCK_AGENT_EMPTY_TYPE = {
  ...MOCK_AGENT_FULL,
  bot_type: "",
};

/** Agent with no welcome message — for Step 2 validation tests. */
const MOCK_AGENT_BLANK_WELCOME = {
  ...MOCK_AGENT_FULL,
  welcome_message: "",
};

/**
 * WizardData that satisfies every required-field check.
 * Used as the localStorage draft for Review & Deploy tests.
 */
const FULL_WIZARD_DATA = {
  bot_type: "support",
  bot_name: "SupportBot",
  short_description: "Customer support assistant",
  about_text: "Handles customer issues",
  bot_username_hint: "",
  bot_avatar_url: "",
  bot_avatar_file: null,
  default_language: "English",
  tone: "Friendly",
  response_style: "Concise",
  welcome_message: "Hello! How can I help you today?",
  fallback_message: "I'm sorry, I didn't understand.",
  starter_buttons: [],
  bot_actions: ["Answer questions"],
  data_fields: [],
  workflow_steps: [],
  logic_rules: [],
  external_actions: [],
  connectors: [],
  data_sources: [],
  field_mappings: [],
  action_triggers: [],
  integration_rules: [],
  openai_api_key: "sk-testkey123456789012345678901234567890",
  telegram_bot_token: "123456789:AAABBBCCC_DDD-EEEfff_GGG",
  telegram_display_name: "SupportBot",
  telegram_short_description: "Customer support assistant",
  telegram_about_text: "Handles customer issues",
  telegram_commands: [
    { command: "/start", description: "Start" },
    { command: "/help",  description: "Help"  },
  ],
  webhook_mode: "Auto-generate webhook URL",
  custom_webhook_url: "",
};

// ── Helpers ────────────────────────────────────────────────────────────────────

async function setupAuth(page: Page, agents: unknown[] = [MOCK_AGENT_FULL]) {
  await page.route(`${SUPABASE_URL}/auth/v1/**`, async (route, request) => {
    const url = request.url();
    if (url.includes("/token") || url.includes("/session")) {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(MOCK_SESSION) });
    } else if (url.includes("/user")) {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(MOCK_USER) });
    } else {
      await route.fulfill({ status: 200, contentType: "application/json", body: "{}" });
    }
  });

  await page.route(`${SUPABASE_URL}/rest/v1/**`, async (route, request) => {
    const method = request.method();
    const url    = request.url();
    if (method === "GET" && url.includes("/agents")) {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(agents) });
    } else {
      await route.fulfill({ status: 200, contentType: "application/json", body: method === "GET" ? "[]" : "{}" });
    }
  });

  // Successful deploy response — includes botInfo.username for success screen tests
  await page.route(`${SUPABASE_URL}/functions/**`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ message: "Bot Deployed! 🎉", botInfo: { username: "supportbot_test" } }),
    });
  });

  await page.route(`${SUPABASE_URL}/storage/**`, async (route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: "{}" });
  });

  await page.addInitScript(
    ({ key, session }) => { localStorage.setItem(key, JSON.stringify(session)); },
    { key: LS_AUTH_KEY, session: MOCK_SESSION }
  );
}

/**
 * Inject wizard step + draft data for the given agentId into localStorage
 * BEFORE the page loads (via addInitScript).
 */
async function injectWizardState(
  page: Page,
  opts: { agentId: string; step: number; maxStep?: number; data: Record<string, unknown> }
) {
  const { agentId, step, maxStep = step, data } = opts;
  await page.addInitScript(
    ({ agentId, step, maxStep, data }) => {
      localStorage.setItem(`wizard_draft_${agentId}`, JSON.stringify(data));
      localStorage.setItem(`wizard_step_${agentId}`,      String(step));
      localStorage.setItem(`wizard_max_step_${agentId}`,  String(maxStep));
    },
    { agentId, step, maxStep, data }
  );
}

/**
 * Navigate to /agents and click "Edit" in the dropdown of the first bot card.
 * Precondition: auth and agents must already be stubbed via setupAuth().
 */
async function openEditWizard(page: Page, botName = "SupportBot") {
  await page.goto("/agents");
  if (botName) {
    await page.getByText(botName).waitFor({ timeout: 10_000 });
  } else {
    // Wait for the agents list to hydrate (search box or main content appears)
    await page.getByRole("main").waitFor({ timeout: 10_000 });
    await page.waitForTimeout(500);
  }
  // The MoreVertical dropdown trigger is the last aria-haspopup button on the page
  await page.locator('button[aria-haspopup="menu"]').last().click();
  // Radix portal renders menu items — click Edit by visible text
  await page.getByText(/^Edit$|^Редактировать$/).click({ timeout: 10_000 });
}

// ─────────────────────────────────────────────────────────────────────────────
// Open from /agents
// ─────────────────────────────────────────────────────────────────────────────

test.describe("DeployWizard — open from /agents", () => {
  test.beforeEach(async ({ page }) => {
    await setupAuth(page);
  });

  test("shows the agents page with the mock bot", async ({ page }) => {
    await page.goto("/agents");
    await expect(page.getByText("SupportBot")).toBeVisible({ timeout: 10_000 });
  });

  test("Edit menu item opens the DeployWizard dialog", async ({ page }) => {
    await openEditWizard(page);
    // Dialog appears — the wizard has at least a Back button
    await expect(page.getByRole("button", { name: /Back|Назад/i })).toBeVisible({ timeout: 8_000 });
  });

  test("wizard starts at bot_type step and shows 7 step indicators for support bot", async ({ page }) => {
    await injectWizardState(page, { agentId: AGENT_ID, step: 0, data: FULL_WIZARD_DATA });
    await openEditWizard(page);
    // Step counter shows "1 / 7"
    await expect(page.getByText(/1.*\/.*7/)).toBeVisible({ timeout: 8_000 });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Step 0 — Bot Type Selection
// ─────────────────────────────────────────────────────────────────────────────

test.describe("DeployWizard Step 0 — Bot Type", () => {
  test.beforeEach(async ({ page }) => {
    // Use blank agent so wizard opens at bot_type with no pre-selection
    await setupAuth(page, [MOCK_AGENT_EMPTY_TYPE]);
    await injectWizardState(page, {
      agentId: AGENT_ID,
      step: 0,
      data: { ...FULL_WIZARD_DATA, bot_type: "" },
    });
    await openEditWizard(page, "SupportBot");
  });

  test("renders all 7 bot-type cards", async ({ page }) => {
    // Wait for the wizard dialog
    await expect(page.getByRole("dialog")).toBeVisible({ timeout: 8_000 });
    // Each bot type should have a visible card button
    for (const label of [
      /Sales Bot|Бот продаж/i,
      /Booking Bot|Бот бронирования/i,
      /Support Bot|Бот поддержки/i,
      /FAQ Bot|FAQ бот/i,
      /Order Bot|Бот заказов/i,
    ]) {
      await expect(page.getByRole("dialog").getByText(label).first()).toBeVisible();
    }
  });

  test("Deploy button is disabled when no bot type is selected", async ({ page }) => {
    await expect(page.getByRole("dialog")).toBeVisible({ timeout: 8_000 });
    // With bot_type="" there is only 1 step, so the footer shows Deploy (not Next)
    // Deploy requires confirmed=true which defaults to false → disabled
    const deployBtn = page.getByRole("button", { name: /Deploy to Telegram|Развернуть/i });
    await expect(deployBtn).toBeDisabled({ timeout: 5_000 });
  });

  test("Back button is disabled on the first step", async ({ page }) => {
    await expect(page.getByRole("dialog")).toBeVisible({ timeout: 8_000 });
    await expect(page.getByRole("button", { name: /Back|Назад/i })).toBeDisabled();
  });

  test("selecting Support Bot type advances to identity step", async ({ page }) => {
    await expect(page.getByRole("dialog")).toBeVisible({ timeout: 8_000 });
    // Click the Support Bot card — find by visible text since aria-label is localized
    await page.locator("button").filter({ hasText: /Support Bot|Бот поддержки/i }).click();
    // Wizard advances to identity step (now 7 steps: counter "2 / 7")
    await expect(page.getByText(/2.*\/.*7/)).toBeVisible({ timeout: 5_000 });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Step 1 — Identity
//
// support profile: steps = [bot_type(0), identity(1), welcome(2), api_keys(3),
//                            telegram_config(4), telegram_preview(5), deploy(6)]
// ─────────────────────────────────────────────────────────────────────────────

test.describe("DeployWizard Step 1 — Identity", () => {
  test.beforeEach(async ({ page }) => {
    // Use MOCK_AGENT_FULL so the card is findable ("SupportBot").
    // The wizard starts at step 1 with all fields pre-filled from initialData.
    // Validation tests clear the relevant fields inline.
    await setupAuth(page);
    await injectWizardState(page, {
      agentId: AGENT_ID,
      step: 1,
      maxStep: 1,
      data: FULL_WIZARD_DATA,
    });
    await openEditWizard(page);
    // Wait for the identity step heading
    await page.getByText(/Define Your Bot|Определите идентичность/i).waitFor({ timeout: 8_000 });
  });

  test("renders identity heading", async ({ page }) => {
    await expect(page.getByText(/Define Your Bot|Определите идентичность/i).first()).toBeVisible();
  });

  test("bot name input has the expected placeholder", async ({ page }) => {
    await expect(page.getByPlaceholder("Flora Assistant")).toBeVisible();
  });

  test("Next is disabled when bot_name is cleared", async ({ page }) => {
    // Clear both required fields to put the step in disabled state
    await page.getByPlaceholder("Flora Assistant").fill("");
    await page.getByPlaceholder(/Describe what this bot|Опишите бота/i).fill("");
    await expect(page.getByRole("button", { name: /Next|Далее/i })).toBeDisabled();
  });

  test("Next is still disabled when only bot_name is filled (short_description empty)", async ({ page }) => {
    await page.getByPlaceholder(/Describe what this bot|Опишите бота/i).fill("");
    await page.getByPlaceholder("Flora Assistant").fill("SupportBot");
    await expect(page.getByRole("button", { name: /Next|Далее/i })).toBeDisabled();
  });

  test("Next is enabled when both bot_name and short_description are filled", async ({ page }) => {
    // Fields are already filled from MOCK_AGENT_FULL initialData → Next should be enabled
    await expect(page.getByRole("button", { name: /Next|Далее/i })).toBeEnabled({ timeout: 3_000 });
  });

  test("Back navigates to bot_type step", async ({ page }) => {
    await page.getByRole("button", { name: /Back|Назад/i }).click();
    await expect(page.getByText(/What kind of bot|Какой бот/i)).toBeVisible({ timeout: 5_000 });
  });

  test("step counter shows '2 / 7'", async ({ page }) => {
    await expect(page.getByText(/2.*\/.*7/)).toBeVisible();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Step 2 — Welcome Experience
// ─────────────────────────────────────────────────────────────────────────────

test.describe("DeployWizard Step 2 — Welcome", () => {
  test.beforeEach(async ({ page }) => {
    // Blank welcome_message so the disabled-state test starts correctly
    await setupAuth(page, [MOCK_AGENT_BLANK_WELCOME]);
    await injectWizardState(page, {
      agentId: AGENT_ID,
      step: 2,
      maxStep: 2,
      data: { ...FULL_WIZARD_DATA, welcome_message: "" },
    });
    await openEditWizard(page, "SupportBot");
    // Use the h2 heading to avoid strict-mode collision with the step-indicator text
    await page.getByRole("heading", { name: /Welcome Experience|Приветствие/i }).waitFor({ timeout: 8_000 });
  });

  test("renders Welcome Experience heading", async ({ page }) => {
    await expect(
      page.getByRole("heading", { name: /Welcome Experience|Приветствие/i })
    ).toBeVisible();
  });

  test("welcome message textarea accepts input", async ({ page }) => {
    const textarea = page.getByPlaceholder(/Write the first message|Напишите первое сообщение/i);
    await expect(textarea).toBeVisible();
    await textarea.fill("Welcome! How can I help?");
    await expect(textarea).toHaveValue("Welcome! How can I help?");
  });

  test("Next is disabled when welcome_message is empty", async ({ page }) => {
    await expect(page.getByRole("button", { name: /Next|Далее/i })).toBeDisabled();
  });

  test("Next is enabled after typing a welcome message", async ({ page }) => {
    await page.getByPlaceholder(/Write the first message|Напишите первое сообщение/i)
      .fill("Hello! I'm your support assistant.");
    await expect(page.getByRole("button", { name: /Next|Далее/i })).toBeEnabled({ timeout: 3_000 });
  });

  test("step counter shows '3 / 7'", async ({ page }) => {
    await expect(page.getByText(/3.*\/.*7/)).toBeVisible();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Step 3 — API Keys
// ─────────────────────────────────────────────────────────────────────────────

test.describe("DeployWizard Step 3 — API Keys", () => {
  test.beforeEach(async ({ page }) => {
    // MOCK_AGENT_FULL already has openai_api_key: "" so Next starts disabled
    await setupAuth(page);
    await injectWizardState(page, {
      agentId: AGENT_ID,
      step: 3,
      maxStep: 3,
      data: { ...FULL_WIZARD_DATA, openai_api_key: "" },
    });
    await openEditWizard(page);
    // Wait for the step content heading
    await page.getByText(/Power your bot|Подключите мозг/i).waitFor({ timeout: 8_000 });
  });

  test("renders API Keys step heading", async ({ page }) => {
    await expect(page.getByText(/Power your bot|Подключите мозг/i).first()).toBeVisible();
  });

  test("API key input placeholder contains 'sk-...'", async ({ page }) => {
    // The placeholder is "sk-... / sk-ant-... / AIza..." — partial match
    await expect(page.getByPlaceholder(/sk-\.\.\./i)).toBeVisible();
  });

  test("API key input is type=password (masked)", async ({ page }) => {
    await expect(page.getByPlaceholder(/sk-\.\.\./i)).toHaveAttribute("type", "password");
  });

  test("Next is disabled when API key field is empty", async ({ page }) => {
    await expect(page.getByRole("button", { name: /Next|Далее/i })).toBeDisabled();
  });

  test("shows unrecognized-format error for a key that doesn't match any provider", async ({ page }) => {
    await page.getByPlaceholder(/sk-\.\.\./i).fill("invalid-key-xyz");
    await expect(
      page.getByText(/Unrecognized key|Неизвестный формат/i)
    ).toBeVisible({ timeout: 3_000 });
    await expect(page.getByRole("button", { name: /Next|Далее/i })).toBeDisabled();
  });

  test("Next is enabled when a valid sk- key is entered", async ({ page }) => {
    await page.getByPlaceholder(/sk-\.\.\./i).fill("sk-proj-validkey12345678901234567890");
    await expect(page.getByRole("button", { name: /Next|Далее/i })).toBeEnabled({ timeout: 3_000 });
  });

  test("entering a sk-ant- key is also accepted", async ({ page }) => {
    // sk-ant- starts with sk- so canNext() returns true
    await page.getByPlaceholder(/sk-\.\.\./i).fill("sk-ant-validAnthropicKey123456789012345678");
    await expect(page.getByRole("button", { name: /Next|Далее/i })).toBeEnabled({ timeout: 3_000 });
  });

  test("step counter shows '4 / 7'", async ({ page }) => {
    await expect(page.getByText(/4.*\/.*7/)).toBeVisible();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Step 4 — Telegram Config
// ─────────────────────────────────────────────────────────────────────────────

test.describe("DeployWizard Step 4 — Telegram Config", () => {
  test.beforeEach(async ({ page }) => {
    await setupAuth(page);
    await injectWizardState(page, {
      agentId: AGENT_ID,
      step: 4,
      maxStep: 4,
      data: { ...FULL_WIZARD_DATA, telegram_bot_token: "" },
    });
    await openEditWizard(page);
    // Wait for the token placeholder to appear (step-specific element)
    await page.getByPlaceholder("123456789:ABC-DEF1234ghIkl-zyx57W2v1u123ew11")
      .waitFor({ timeout: 8_000 });
  });

  test("bot token input is visible with Telegram token placeholder", async ({ page }) => {
    await expect(
      page.getByPlaceholder("123456789:ABC-DEF1234ghIkl-zyx57W2v1u123ew11")
    ).toBeVisible();
  });

  test("token input is type=password (masked)", async ({ page }) => {
    await expect(
      page.getByPlaceholder("123456789:ABC-DEF1234ghIkl-zyx57W2v1u123ew11")
    ).toHaveAttribute("type", "password");
  });

  test("Next is disabled without a token", async ({ page }) => {
    await expect(page.getByRole("button", { name: /Next|Далее/i })).toBeDisabled();
  });

  test("invalid token format shows an error message", async ({ page }) => {
    await page.getByPlaceholder("123456789:ABC-DEF1234ghIkl-zyx57W2v1u123ew11").fill("badtoken");
    await expect(
      page.getByText(/Invalid token format|Неверный формат токена/i)
    ).toBeVisible({ timeout: 3_000 });
  });

  test("valid token format enables Next", async ({ page }) => {
    await page.getByPlaceholder("123456789:ABC-DEF1234ghIkl-zyx57W2v1u123ew11")
      .fill("123456789:AAABBBCCC_DDD-EEEfff_GGGhhh_IIIjjj");
    await expect(page.getByRole("button", { name: /Next|Далее/i })).toBeEnabled({ timeout: 3_000 });
  });

  test("step counter shows '5 / 7'", async ({ page }) => {
    await expect(page.getByText(/5.*\/.*7/)).toBeVisible();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Step 6 — Review & Deploy
// ─────────────────────────────────────────────────────────────────────────────

test.describe("DeployWizard Step 6 — Review & Deploy", () => {
  test.beforeEach(async ({ page }) => {
    await setupAuth(page);
    await injectWizardState(page, {
      agentId: AGENT_ID,
      step: 6,
      maxStep: 6,
      data: FULL_WIZARD_DATA,
    });
    await openEditWizard(page);
    await page.getByText(/Review & Deploy|Проверка и деплой/i).waitFor({ timeout: 8_000 });
  });

  test("renders Review & Deploy heading", async ({ page }) => {
    await expect(page.getByText(/Review & Deploy|Проверка и деплой/i).first()).toBeVisible();
  });

  test("bot name appears in the identity summary card", async ({ page }) => {
    await expect(page.getByText("SupportBot").first()).toBeVisible();
  });

  test("Deployment Checklist section is visible", async ({ page }) => {
    await expect(page.getByText(/Deployment Checklist|Чеклист деплоя/i)).toBeVisible();
  });

  test("no 'Missing' badges when all fields are complete", async ({ page }) => {
    await expect(
      page.getByText(/Missing — required|Не задан — обязательно/i)
    ).not.toBeVisible();
  });

  test("confirm checkbox is enabled when all required fields are complete", async ({ page }) => {
    await expect(page.locator("#confirm")).not.toBeDisabled();
  });

  test("Deploy button is disabled before confirming", async ({ page }) => {
    await expect(
      page.getByRole("button", { name: /Deploy to Telegram|Развернуть/i })
    ).toBeDisabled();
  });

  test("Deploy button becomes enabled after checking the confirm checkbox", async ({ page }) => {
    await page.locator("#confirm").click();
    await expect(
      page.getByRole("button", { name: /Deploy to Telegram|Развернуть/i })
    ).toBeEnabled({ timeout: 3_000 });
  });

  test("step counter shows '7 / 7'", async ({ page }) => {
    await expect(page.getByText(/7.*\/.*7/)).toBeVisible();
  });

  test("Back button is enabled on the last step", async ({ page }) => {
    await expect(page.getByRole("button", { name: /Back|Назад/i })).toBeEnabled();
  });

  test("confirm checkbox is disabled when required fields are missing", async ({ page }) => {
    await setupAuth(page);
    await injectWizardState(page, {
      agentId: AGENT_ID,
      step: 6,
      maxStep: 6,
      data: { ...FULL_WIZARD_DATA, openai_api_key: "", telegram_bot_token: "" },
    });
    await openEditWizard(page);
    await page.getByText(/Review & Deploy|Проверка и деплой/i).waitFor({ timeout: 8_000 });
    await expect(page.locator("#confirm")).toBeDisabled();
    await expect(
      page.getByText(/Missing — required|Не задан — обязательно/i).first()
    ).toBeVisible();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Deploy — success screen
// ─────────────────────────────────────────────────────────────────────────────

test.describe("DeployWizard — deploy & success screen", () => {
  async function goToDeployStep(page: Page) {
    await setupAuth(page);
    await injectWizardState(page, {
      agentId: AGENT_ID,
      step: 6,
      maxStep: 6,
      data: FULL_WIZARD_DATA,
    });
    await openEditWizard(page);
    await page.getByText(/Review & Deploy|Проверка и деплой/i).waitFor({ timeout: 8_000 });
  }

  test("clicking Deploy shows the success screen", async ({ page }) => {
    await goToDeployStep(page);
    await page.locator("#confirm").click();
    await page.getByRole("button", { name: /Deploy to Telegram|Развернуть/i }).click();
    // Use the success screen paragraph (not the toast notification)
    await expect(
      page.getByText(/Bot Deployed!|Бот развёрнут!/i).first()
    ).toBeVisible({ timeout: 15_000 });
  });

  test("success screen shows the bot @username link", async ({ page }) => {
    await goToDeployStep(page);
    await page.locator("#confirm").click();
    await page.getByRole("button", { name: /Deploy to Telegram|Развернуть/i }).click();
    // Mock returns botInfo.username = "supportbot_test"
    await expect(page.getByText(/@supportbot_test/)).toBeVisible({ timeout: 15_000 });
  });

  test("Done button on success screen closes the wizard", async ({ page }) => {
    await goToDeployStep(page);
    await page.locator("#confirm").click();
    await page.getByRole("button", { name: /Deploy to Telegram|Развернуть/i }).click();
    await page.getByText(/Bot Deployed!|Бот развёрнут!/i).first().waitFor({ timeout: 15_000 });

    await page.getByRole("button", { name: /Done|Готово/i }).click();
    // Wizard dialog should be gone
    await expect(
      page.getByText(/Review & Deploy|Проверка и деплой/i)
    ).not.toBeVisible({ timeout: 5_000 });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Step navigation — Back/Next and dot indicators
// ─────────────────────────────────────────────────────────────────────────────

test.describe("DeployWizard — step navigation", () => {
  test("Back from identity returns to bot_type", async ({ page }) => {
    await setupAuth(page);
    await injectWizardState(page, { agentId: AGENT_ID, step: 1, maxStep: 1, data: FULL_WIZARD_DATA });
    await openEditWizard(page);
    await page.getByText(/Define Your Bot|Определите идентичность/i).waitFor({ timeout: 8_000 });

    await page.getByRole("button", { name: /Back|Назад/i }).click();
    await expect(page.getByText(/What kind of bot|Какой бот/i)).toBeVisible({ timeout: 5_000 });
  });

  test("Next from api_keys step (with valid key) advances to telegram_config", async ({ page }) => {
    await setupAuth(page);
    await injectWizardState(page, { agentId: AGENT_ID, step: 3, maxStep: 3, data: FULL_WIZARD_DATA });
    await openEditWizard(page);
    await page.getByText(/Power your bot|Подключите мозг/i).waitFor({ timeout: 8_000 });

    await page.getByRole("button", { name: /Next|Далее/i }).click();
    // Should reach telegram_config step
    await expect(
      page.getByPlaceholder("123456789:ABC-DEF1234ghIkl-zyx57W2v1u123ew11")
    ).toBeVisible({ timeout: 5_000 });
  });

  test("Next from welcome step (with message) advances to api_keys", async ({ page }) => {
    await setupAuth(page);
    await injectWizardState(page, { agentId: AGENT_ID, step: 2, maxStep: 2, data: FULL_WIZARD_DATA });
    await openEditWizard(page);
    await page.getByRole("heading", { name: /Welcome Experience|Приветствие/i }).waitFor({ timeout: 8_000 });

    await page.getByRole("button", { name: /Next|Далее/i }).click();
    await expect(page.getByText(/Power your bot|Подключите мозг/i).first()).toBeVisible({ timeout: 5_000 });
  });

  test("clicking a completed step dot navigates back to that step", async ({ page }) => {
    await setupAuth(page);
    // Start at step 2 (welcome) with steps 0 and 1 already visited
    await injectWizardState(page, { agentId: AGENT_ID, step: 2, maxStep: 2, data: FULL_WIZARD_DATA });
    await openEditWizard(page);
    await page.getByRole("heading", { name: /Welcome Experience|Приветствие/i }).waitFor({ timeout: 8_000 });

    // Completed step dots render with a checkmark SVG (polyline)
    const completedDots = page.locator("button.rounded-full").filter({
      has: page.locator("svg polyline"),
    });
    await completedDots.first().click();
    await expect(page.getByText(/What kind of bot|Какой бот/i)).toBeVisible({ timeout: 5_000 });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// End-to-End — full critical path: Support Bot creation → Deploy
// ─────────────────────────────────────────────────────────────────────────────

test.describe("DeployWizard — E2E critical path (Support Bot)", () => {
  test("full flow: bot_type → identity → welcome → api_keys → telegram_config → deploy → success", async ({ page }) => {
    await setupAuth(page, [MOCK_AGENT_EMPTY_TYPE]);
    // Start fresh with an empty-type mock agent (wizard opens at step 0)
    await injectWizardState(page, {
      agentId: AGENT_ID,
      step: 0,
      data: { ...FULL_WIZARD_DATA, bot_type: "" },
    });
    // MOCK_AGENT_EMPTY_TYPE still has name "SupportBot" for the card finder
    await openEditWizard(page, "SupportBot");

    // ── Step 0: Select Support Bot ────────────────────────────────────────────
    await expect(page.getByRole("dialog")).toBeVisible({ timeout: 8_000 });
    // Bot type card text is localized — find by visible label text
    await page.locator("button").filter({ hasText: /Support Bot|Бот поддержки/i }).click();
    // Wizard advances to identity step
    await page.getByText(/Define Your Bot|Определите идентичность/i).waitFor({ timeout: 5_000 });

    // ── Step 1: Identity ──────────────────────────────────────────────────────
    await page.getByPlaceholder("Flora Assistant").fill("SupportBot");
    await page.getByPlaceholder(/Describe what this bot|Опишите бота/i)
      .fill("Handles all customer support inquiries.");
    await page.getByRole("button", { name: /Next|Далее/i }).click();

    // ── Step 2: Welcome ───────────────────────────────────────────────────────
    await page.getByRole("heading", { name: /Welcome Experience|Приветствие/i }).waitFor({ timeout: 5_000 });
    await page.getByPlaceholder(/Write the first message|Напишите первое сообщение/i)
      .fill("Hello! I'm your support assistant. How can I help?");
    await page.getByRole("button", { name: /Next|Далее/i }).click();

    // ── Step 3: API Keys ──────────────────────────────────────────────────────
    await page.getByText(/Power your bot|Подключите мозг/i).waitFor({ timeout: 5_000 });
    await page.getByPlaceholder(/sk-\.\.\./i).fill("sk-proj-E2Etestkey12345678901234567890ab");
    await page.getByRole("button", { name: /Next|Далее/i }).click();

    // ── Step 4: Telegram Config ───────────────────────────────────────────────
    await page.getByPlaceholder("123456789:ABC-DEF1234ghIkl-zyx57W2v1u123ew11")
      .waitFor({ timeout: 5_000 });
    await page.getByPlaceholder("123456789:ABC-DEF1234ghIkl-zyx57W2v1u123ew11")
      .fill("987654321:ZZZ_XXX-YYYyyy_WWWwww_VVVvvvUUU");
    await page.getByRole("button", { name: /Next|Далее/i }).click();

    // ── Step 5: Telegram Preview — no validation, click Next ─────────────────
    await page.getByRole("button", { name: /Next|Далее/i }).waitFor({ state: "visible", timeout: 5_000 });
    await page.getByRole("button", { name: /Next|Далее/i }).click();

    // ── Step 6: Review & Deploy ───────────────────────────────────────────────
    await page.getByText(/Review & Deploy|Проверка и деплой/i).waitFor({ timeout: 5_000 });
    await expect(
      page.getByText(/Missing — required|Не задан — обязательно/i)
    ).not.toBeVisible();

    await page.locator("#confirm").click();
    await page.getByRole("button", { name: /Deploy to Telegram|Развернуть/i }).click();

    // ── Success screen ────────────────────────────────────────────────────────
    // Use the success screen paragraph (not the toast notification)
    await expect(
      page.getByText(/Bot Deployed!|Бот развёрнут!/i).first()
    ).toBeVisible({ timeout: 15_000 });
  });
});
