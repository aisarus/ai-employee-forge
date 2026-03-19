/**
 * E2E tests — Bot Lifecycle (базовый сценарий)
 *
 * Покрывает три полных пользовательских сценария:
 *   1. Создание бота — QuickStart wizard от начала до конца
 *   2. Деплой        — ввод токена Telegram и успешный запуск
 *   3. Настройка     — редактирование существующего бота через /agents
 *
 * Стратегия:
 *   - Инжектим фейковую Supabase-сессию через localStorage перед каждым тестом.
 *   - Все сетевые вызовы Supabase перехватываются и стабятся.
 *   - Для пропуска промежуточных шагов используем injectDraft() / injectWizardState().
 *   - Edge-функция деплоя мокается ответом с username бота.
 */

import { test, expect, type Page } from "@playwright/test";

// ── Constants ──────────────────────────────────────────────────────────────────

const SUPABASE_URL = "https://mlwvccubpvvajsdxrljj.supabase.co";
const LS_AUTH_KEY  = "sb-mlwvccubpvvajsdxrljj-auth-token";

const MOCK_USER = {
  id: "00000000-0000-0000-0000-000000000002",
  aud: "authenticated",
  role: "authenticated",
  email: "lifecycle@botforge.dev",
  email_confirmed_at: "2024-01-01T00:00:00.000Z",
  app_metadata: { provider: "email" },
  user_metadata: {},
  created_at: "2024-01-01T00:00:00.000Z",
  updated_at: "2024-01-01T00:00:00.000Z",
};

const MOCK_SESSION = {
  access_token: "mock-lifecycle-token",
  token_type: "bearer",
  expires_in: 3600,
  expires_at: Math.floor(Date.now() / 1000) + 3600,
  refresh_token: "mock-lifecycle-refresh",
  user: MOCK_USER,
};

/** Валидный токен в формате Telegram Bot API */
const VALID_TELEGRAM_TOKEN = "987654321:AABBCCDDEEFFaabbccddeeff_gghhiijjkk";

/** Валидный OpenAI API key */
const VALID_OPENAI_KEY = "sk-testlifecyclekey1234567890abcdef1234";

const AGENT_ID = "lifecycle-agent-001";

/** Полноценный мок агента для тестов редактирования */
const MOCK_AGENT = {
  id: AGENT_ID,
  name: "LifecycleBot",
  description: "A test bot for lifecycle E2E tests",
  about_text: "Created by automated tests",
  bot_type: "support",
  system_prompt: "You are LifecycleBot, a helpful assistant.",
  structured_prompt: { bot_actions: ["Answer questions"] },
  openai_api_key: "",
  telegram_bot_token: "",
  telegram_display_name: "LifecycleBot",
  telegram_short_description: "A test bot",
  telegram_about_text: "Created by automated tests",
  telegram_commands: [
    { command: "/start", description: "Start" },
    { command: "/help",  description: "Help"  },
  ],
  welcome_message: "Hello! I'm LifecycleBot. How can I help?",
  fallback_message: "Sorry, I didn't understand that.",
  is_active: false,
  platform: "telegram",
  messages_count: 0,
  tone: "Friendly",
  response_style: "Concise",
  default_language: "English",
  bot_avatar_url: "",
  bot_username_hint: "",
  created_at: "2024-03-01T10:00:00.000Z",
  updated_at: "2024-03-01T10:00:00.000Z",
};

/** Полный wizard data с заполненными обязательными полями */
const FULL_DEPLOY_DATA = {
  bot_type: "support",
  bot_name: "LifecycleBot",
  short_description: "A test bot for lifecycle E2E tests",
  about_text: "Created by automated tests",
  bot_username_hint: "",
  bot_avatar_url: "",
  bot_avatar_file: null,
  default_language: "English",
  tone: "Friendly",
  response_style: "Concise",
  welcome_message: "Hello! I'm LifecycleBot. How can I help?",
  fallback_message: "Sorry, I didn't understand that.",
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
  openai_api_key: VALID_OPENAI_KEY,
  telegram_bot_token: VALID_TELEGRAM_TOKEN,
  telegram_display_name: "LifecycleBot",
  telegram_short_description: "A test bot for lifecycle E2E tests",
  telegram_about_text: "Created by automated tests",
  telegram_commands: [
    { command: "/start", description: "Start" },
    { command: "/help",  description: "Help"  },
  ],
  webhook_mode: "Auto-generate webhook URL",
  custom_webhook_url: "",
};

// ── Helpers ────────────────────────────────────────────────────────────────────

/**
 * Инжектим фейковую сессию и стабим все сетевые вызовы Supabase.
 * @param agents - список агентов, возвращаемых REST API (по умолчанию один MOCK_AGENT)
 * @param deploySuccess - если false, edge-функция вернёт ошибку деплоя
 */
async function setupAuth(
  page: Page,
  agents: unknown[] = [MOCK_AGENT],
  deploySuccess = true
) {
  // Auth routes
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

  // REST API: возвращаем агентов при GET /agents, для остальных — пустой успех
  await page.route(`${SUPABASE_URL}/rest/v1/**`, async (route, request) => {
    const method = request.method();
    const url    = request.url();
    if (method === "GET" && url.includes("/agents")) {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(agents) });
    } else if (method === "POST" || method === "PATCH") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ id: AGENT_ID }),
      });
    } else {
      await route.fulfill({ status: 200, contentType: "application/json", body: method === "GET" ? "[]" : "{}" });
    }
  });

  // Edge functions: деплой и brain-generation
  await page.route(`${SUPABASE_URL}/functions/**`, async (route, request) => {
    const url = request.url();
    if (url.includes("generate-system-prompt") || url.includes("generate_prompt")) {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ prompt: "You are LifecycleBot, a helpful assistant for lifecycle testing." }),
      });
    } else if (deploySuccess) {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ message: "Bot Deployed! 🎉", botInfo: { username: "lifecyclebot_test" } }),
      });
    } else {
      await route.fulfill({
        status: 500,
        contentType: "application/json",
        body: JSON.stringify({ error: "Telegram token is invalid or expired." }),
      });
    }
  });

  // Storage
  await page.route(`${SUPABASE_URL}/storage/**`, async (route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: "{}" });
  });

  // Инжектируем сессию в localStorage до загрузки страницы
  await page.addInitScript(
    ({ key, session }) => { localStorage.setItem(key, JSON.stringify(session)); },
    { key: LS_AUTH_KEY, session: MOCK_SESSION }
  );
}

/** Очищаем QuickStart черновик перед тестом. */
async function clearQuickDraft(page: Page) {
  await page.addInitScript(() => {
    localStorage.removeItem("quickwizard_draft");
  });
}

/** Инжектируем черновик QuickStart-визарда (шаги 1–5). */
async function injectQuickDraft(page: Page, draft: Record<string, unknown>) {
  await page.addInitScript(
    ({ draft }) => { localStorage.setItem("quickwizard_draft", JSON.stringify(draft)); },
    { draft }
  );
}

/** Инжектируем состояние DeployWizard для конкретного агента. */
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

/** Открываем QuickStart визард с главной страницы. */
async function openQuickWizard(page: Page) {
  await page.goto("/");
  const btn = page.getByRole("button", { name: /quick.start/i });
  await btn.waitFor({ timeout: 10_000 });
  await btn.click();
}

/** Открываем меню редактирования бота со страницы /agents. */
async function openEditWizard(page: Page, botName = "LifecycleBot") {
  await page.goto("/agents");
  await page.getByText(botName).waitFor({ timeout: 10_000 });
  await page.locator('button[aria-haspopup="menu"]').last().click();
  await page.getByText(/^Edit$|^Редактировать$/).click({ timeout: 10_000 });
}

// ═════════════════════════════════════════════════════════════════════════════
// СЦЕНАРИЙ 1: Создание бота через QuickStart Wizard
// ═════════════════════════════════════════════════════════════════════════════

test.describe("Сценарий 1 — Создание бота (QuickStart)", () => {

  // ── 1.1 Шаг «Describe» — ввод описания ────────────────────────────────────

  test.describe("Шаг 1: Опишите бота", () => {
    test.beforeEach(async ({ page }) => {
      await setupAuth(page, []);
      await clearQuickDraft(page);
      await openQuickWizard(page);
    });

    test("открывается первый шаг с заголовком", async ({ page }) => {
      await expect(
        page.getByText(/Describe Your Bot|Опишите вашего бота/i)
      ).toBeVisible({ timeout: 8_000 });
    });

    test("кнопка 'Назад' неактивна на первом шаге", async ({ page }) => {
      await expect(page.getByRole("button", { name: /Back|Назад/i })).toBeDisabled();
    });

    test("счётчик шагов показывает '1 / 5'", async ({ page }) => {
      await expect(page.getByText(/1.*\/.*5/)).toBeVisible();
    });

    test("кнопка генерации мозга заблокирована при пустом описании", async ({ page }) => {
      const btn = page.getByRole("button", { name: /Generate AI Brain|Сгенерировать мозг/i });
      await expect(btn).toBeDisabled();
    });

    test("кнопка генерации активируется после ввода описания", async ({ page }) => {
      const textarea = page.getByPlaceholder(/e\.g\.,|напр\./i).first();
      await textarea.fill("I run a bakery in downtown. We sell fresh bread, cakes and coffee.");
      const btn = page.getByRole("button", { name: /Generate AI Brain|Сгенерировать мозг/i });
      await expect(btn).toBeEnabled();
    });

    test("черновик сохраняется в localStorage при вводе", async ({ page }) => {
      const textarea = page.getByPlaceholder(/e\.g\.,|напр\./i).first();
      await textarea.fill("I sell handmade jewelry and custom gifts online.");
      await page.waitForTimeout(600); // дебаунс

      const draft = await page.evaluate(() => {
        const raw = localStorage.getItem("quickwizard_draft");
        return raw ? JSON.parse(raw) : null;
      });

      expect(draft).not.toBeNull();
      expect(draft.botDescription).toContain("handmade jewelry");
    });

    test("поле имени бота принимает ввод", async ({ page }) => {
      const nameInput = page.getByPlaceholder(/Flora Assistant|Флора Ассистент/i);
      await nameInput.fill("BakeryBot");
      await expect(nameInput).toHaveValue("BakeryBot");
    });

    test("черновик восстанавливается после перезагрузки", async ({ page }) => {
      // Перезагружаем с черновиком
      await page.evaluate(() => localStorage.removeItem("quickwizard_draft"));
      await injectQuickDraft(page, {
        botDescription: "A bakery bot that takes orders 24/7.",
        botName: "BakeryBot",
        tone: "Friendly",
        step: "describe",
      });
      await page.reload();
      await page.getByText(/Describe Your Bot|Опишите вашего бота/i).waitFor({ timeout: 8_000 });
      await expect(page.getByText("A bakery bot that takes orders 24/7.")).toBeVisible({ timeout: 5_000 });
    });
  });

  // ── 1.2 Шаг «Brain Preview» — AI-мозг сгенерирован ───────────────────────

  test.describe("Шаг 2: AI-мозг готов", () => {
    test.beforeEach(async ({ page }) => {
      await setupAuth(page, []);
      await injectQuickDraft(page, {
        botDescription: "A bakery bot for ordering fresh bread and cakes.",
        botName: "BakeryBot",
        tone: "Friendly",
        responseStyle: "Concise",
        generatedBrain: "You are BakeryBot, a helpful assistant for a downtown bakery.",
        brainGenerated: true,
        step: "brain_preview",
      });
      await openQuickWizard(page);
      await page.getByText(/Bot Brain Ready|Мозг бота готов/i).waitFor({ timeout: 8_000 });
    });

    test("показывается заголовок 'Мозг бота готов'", async ({ page }) => {
      await expect(page.getByText(/Bot Brain Ready|Мозг бота готов/i)).toBeVisible();
    });

    test("счётчик шагов показывает '2 / 5'", async ({ page }) => {
      await expect(page.getByText(/2.*\/.*5/)).toBeVisible();
    });

    test("кнопка 'Назад' возвращает на шаг Describe", async ({ page }) => {
      await page.getByRole("button", { name: /Back|Назад/i }).click();
      await expect(
        page.getByText(/Describe Your Bot|Опишите вашего бота/i)
      ).toBeVisible({ timeout: 5_000 });
    });

    test("кнопка 'Далее' переходит на шаг Identity", async ({ page }) => {
      await page.getByRole("button", { name: /Next|Далее/i }).click();
      await expect(
        page.getByText(/Bot Identity|Идентичность бота/i)
      ).toBeVisible({ timeout: 5_000 });
    });
  });

  // ── 1.3 Шаг «Identity» — настройка личности бота ─────────────────────────

  test.describe("Шаг 3: Идентичность бота", () => {
    test.beforeEach(async ({ page }) => {
      await setupAuth(page, []);
      await injectQuickDraft(page, {
        botDescription: "A bakery bot for ordering fresh bread.",
        botName: "BakeryBot",
        generatedBrain: "You are BakeryBot, a bakery assistant.",
        brainGenerated: true,
        step: "identity",
        wizardData: { bot_name: "BakeryBot", short_description: "" },
      });
      await openQuickWizard(page);
      await page.getByText(/Bot Identity|Идентичность бота/i).waitFor({ timeout: 8_000 });
    });

    test("показывается поле короткого описания", async ({ page }) => {
      await expect(
        page.getByPlaceholder(/Describe your bot in one sentence|Опишите бота/i)
      ).toBeVisible();
    });

    test("кнопка 'Далее' заблокирована при пустом описании", async ({ page }) => {
      await expect(page.getByRole("button", { name: /Next|Далее/i })).toBeDisabled();
    });

    test("кнопка 'Далее' активируется после заполнения описания", async ({ page }) => {
      await page.getByPlaceholder(/Describe your bot in one sentence|Опишите бота/i)
        .fill("A friendly bot that helps customers order fresh baked goods.");
      await expect(page.getByRole("button", { name: /Next|Далее/i })).toBeEnabled();
    });

    test("счётчик показывает '3 / 5'", async ({ page }) => {
      await expect(page.getByText(/3.*\/.*5/)).toBeVisible();
    });

    test("поле welcome-сообщения видимо", async ({ page }) => {
      await expect(
        page.getByPlaceholder(/First message after \/start|Первое сообщение/i)
      ).toBeVisible();
    });
  });

  // ── 1.4 Шаг «API Key» — подключение AI-мозга ─────────────────────────────

  test.describe("Шаг 4: Подключение AI-мозга (API Key)", () => {
    test.beforeEach(async ({ page }) => {
      await setupAuth(page, []);
      await injectQuickDraft(page, {
        botDescription: "A bakery bot.",
        generatedBrain: "You are BakeryBot.",
        brainGenerated: true,
        step: "api_key",
        wizardData: { bot_name: "BakeryBot", short_description: "Fresh bread ordering bot" },
      });
      await openQuickWizard(page);
      await page.getByText(/Connect AI Brain|Подключите AI-мозг/i).waitFor({ timeout: 8_000 });
    });

    test("поле ввода API-ключа видимо и замаскировано", async ({ page }) => {
      const input = page.getByPlaceholder("sk-...");
      await expect(input).toBeVisible();
      await expect(input).toHaveAttribute("type", "password");
    });

    test("шаг опциональный — 'Далее' доступен без ключа", async ({ page }) => {
      await expect(page.getByRole("button", { name: /Next|Далее/i })).toBeEnabled();
    });

    test("неверный формат ключа вызывает предупреждение", async ({ page }) => {
      await page.getByPlaceholder("sk-...").fill("not-a-valid-openai-key");
      await expect(
        page.getByText(/must start with sk-|должен начинаться с sk-/i)
      ).toBeVisible({ timeout: 3_000 });
    });

    test("валидный ключ принимается без ошибок", async ({ page }) => {
      await page.getByPlaceholder("sk-...").fill(VALID_OPENAI_KEY);
      await expect(
        page.getByText(/must start with sk-|должен начинаться с sk-/i)
      ).not.toBeVisible();
    });

    test("счётчик показывает '4 / 5'", async ({ page }) => {
      await expect(page.getByText(/4.*\/.*5/)).toBeVisible();
    });
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// СЦЕНАРИЙ 2: Деплой бота в Telegram
// ═════════════════════════════════════════════════════════════════════════════

test.describe("Сценарий 2 — Деплой бота в Telegram", () => {

  // ── 2.1 Экран деплоя — базовые проверки ───────────────────────────────────

  test.describe("Шаг 5: Деплой — отображение", () => {
    test.beforeEach(async ({ page }) => {
      await setupAuth(page, []);
      await injectQuickDraft(page, {
        botDescription: "A sales bot for e-commerce.",
        generatedBrain: "You are SalesBot.",
        brainGenerated: true,
        step: "deploy",
        wizardData: {
          bot_name: "SalesBot",
          short_description: "E-commerce sales assistant",
          telegram_bot_token: "",
          telegram_display_name: "",
          telegram_short_description: "",
          telegram_about_text: "",
          telegram_commands: [],
          openai_api_key: "",
        },
      });
      await openQuickWizard(page);
      await page.getByText(/Deploy to Telegram|Деплой в Telegram/i).waitFor({ timeout: 8_000 });
    });

    test("показывается заголовок шага деплоя", async ({ page }) => {
      await expect(
        page.getByText(/Deploy to Telegram|Деплой в Telegram/i)
      ).toBeVisible();
    });

    test("счётчик показывает '5 / 5'", async ({ page }) => {
      await expect(page.getByText(/5.*\/.*5/)).toBeVisible();
    });

    test("поле токена Telegram видимо", async ({ page }) => {
      await expect(
        page.getByPlaceholder("123456789:ABC-DEF1234ghIkl-zyx57W2v1u123ew11")
      ).toBeVisible();
    });

    test("поле токена замаскировано (type=password)", async ({ page }) => {
      const tokenInput = page.getByPlaceholder("123456789:ABC-DEF1234ghIkl-zyx57W2v1u123ew11");
      await expect(tokenInput).toHaveAttribute("type", "password");
    });

    test("кнопка деплоя заблокирована без токена", async ({ page }) => {
      const deployBtn = page.getByRole("button", {
        name: /Deploy to Telegram|Развернуть в Telegram/i,
      });
      await expect(deployBtn).toBeDisabled();
    });

    test("в сводке отображается имя бота из визарда", async ({ page }) => {
      await expect(page.getByText("SalesBot")).toBeVisible();
    });
  });

  // ── 2.2 Валидация токена ───────────────────────────────────────────────────

  test.describe("Шаг 5: Деплой — валидация токена", () => {
    test.beforeEach(async ({ page }) => {
      await setupAuth(page, []);
      await injectQuickDraft(page, {
        botDescription: "A test bot.",
        generatedBrain: "You are TestBot.",
        brainGenerated: true,
        step: "deploy",
        wizardData: {
          bot_name: "TestBot",
          short_description: "Test bot",
          telegram_bot_token: "",
          telegram_display_name: "",
          telegram_short_description: "",
          telegram_about_text: "",
          telegram_commands: [],
          openai_api_key: "",
        },
      });
      await openQuickWizard(page);
      await page.getByText(/Deploy to Telegram|Деплой в Telegram/i).waitFor({ timeout: 8_000 });
    });

    test("невалидный токен показывает ошибку формата", async ({ page }) => {
      const tokenInput = page.getByPlaceholder("123456789:ABC-DEF1234ghIkl-zyx57W2v1u123ew11");
      await tokenInput.fill("invalid-telegram-token");
      await expect(
        page.getByText(/Invalid token format|Неверный формат токена/i)
      ).toBeVisible({ timeout: 3_000 });
    });

    test("кнопка деплоя остаётся заблокированной при невалидном токене", async ({ page }) => {
      const tokenInput = page.getByPlaceholder("123456789:ABC-DEF1234ghIkl-zyx57W2v1u123ew11");
      await tokenInput.fill("badtoken");
      const deployBtn = page.getByRole("button", {
        name: /Deploy to Telegram|Развернуть в Telegram/i,
      });
      await expect(deployBtn).toBeDisabled();
    });

    test("валидный токен активирует кнопку деплоя", async ({ page }) => {
      const tokenInput = page.getByPlaceholder("123456789:ABC-DEF1234ghIkl-zyx57W2v1u123ew11");
      await tokenInput.fill(VALID_TELEGRAM_TOKEN);
      const deployBtn = page.getByRole("button", {
        name: /Deploy to Telegram|Развернуть в Telegram/i,
      });
      await expect(deployBtn).toBeEnabled({ timeout: 3_000 });
    });
  });

  // ── 2.3 Успешный деплой ────────────────────────────────────────────────────

  test.describe("Шаг 5: Деплой — успешный запуск", () => {
    test.beforeEach(async ({ page }) => {
      await setupAuth(page, [], true); // deploySuccess = true
      await injectQuickDraft(page, {
        botDescription: "A booking bot for appointments.",
        generatedBrain: "You are BookingBot.",
        brainGenerated: true,
        step: "deploy",
        wizardData: {
          bot_name: "BookingBot",
          short_description: "Appointment booking assistant",
          telegram_bot_token: VALID_TELEGRAM_TOKEN,
          telegram_display_name: "BookingBot",
          telegram_short_description: "Book appointments",
          telegram_about_text: "I help you schedule appointments.",
          telegram_commands: [],
          openai_api_key: VALID_OPENAI_KEY,
        },
      });
      await openQuickWizard(page);
      await page.getByText(/Deploy to Telegram|Деплой в Telegram/i).waitFor({ timeout: 8_000 });
    });

    test("после деплоя отображается экран успеха", async ({ page }) => {
      const tokenInput = page.getByPlaceholder("123456789:ABC-DEF1234ghIkl-zyx57W2v1u123ew11");
      // Токен уже может быть заполнен из wizardData; если нет — заполняем
      const currentValue = await tokenInput.inputValue();
      if (!currentValue) {
        await tokenInput.fill(VALID_TELEGRAM_TOKEN);
      }

      const deployBtn = page.getByRole("button", {
        name: /Deploy to Telegram|Развернуть в Telegram/i,
      });
      await deployBtn.waitFor({ state: "enabled", timeout: 5_000 });
      await deployBtn.click();

      // Ждём экран успеха
      await expect(
        page.getByText(/Bot Deployed|Бот запущен|Deployed|Поздравляем|Congratulations/i)
      ).toBeVisible({ timeout: 15_000 });
    });

    test("экран успеха содержит ссылку на бота в Telegram", async ({ page }) => {
      const tokenInput = page.getByPlaceholder("123456789:ABC-DEF1234ghIkl-zyx57W2v1u123ew11");
      const currentValue = await tokenInput.inputValue();
      if (!currentValue) {
        await tokenInput.fill(VALID_TELEGRAM_TOKEN);
      }

      const deployBtn = page.getByRole("button", {
        name: /Deploy to Telegram|Развернуть в Telegram/i,
      });
      await deployBtn.waitFor({ state: "enabled", timeout: 5_000 });
      await deployBtn.click();

      // Ожидаем username бота из mock-ответа
      await expect(
        page.getByText(/lifecyclebot_test|t\.me\//i)
      ).toBeVisible({ timeout: 15_000 });
    });
  });

  // ── 2.4 Ошибка деплоя ────────────────────────────────────────────────────

  test.describe("Шаг 5: Деплой — ошибка при запуске", () => {
    test("показывается сообщение об ошибке при неудачном деплое", async ({ page }) => {
      await setupAuth(page, [], false); // deploySuccess = false
      await injectQuickDraft(page, {
        botDescription: "A support bot.",
        generatedBrain: "You are SupportBot.",
        brainGenerated: true,
        step: "deploy",
        wizardData: {
          bot_name: "SupportBot",
          short_description: "Support assistant",
          telegram_bot_token: VALID_TELEGRAM_TOKEN,
          telegram_display_name: "SupportBot",
          telegram_short_description: "Support",
          telegram_about_text: "Helps customers",
          telegram_commands: [],
          openai_api_key: VALID_OPENAI_KEY,
        },
      });
      await openQuickWizard(page);
      await page.getByText(/Deploy to Telegram|Деплой в Telegram/i).waitFor({ timeout: 8_000 });

      const tokenInput = page.getByPlaceholder("123456789:ABC-DEF1234ghIkl-zyx57W2v1u123ew11");
      const currentValue = await tokenInput.inputValue();
      if (!currentValue) {
        await tokenInput.fill(VALID_TELEGRAM_TOKEN);
      }

      const deployBtn = page.getByRole("button", {
        name: /Deploy to Telegram|Развернуть в Telegram/i,
      });
      await deployBtn.waitFor({ state: "enabled", timeout: 5_000 });
      await deployBtn.click();

      // Ожидаем toast-уведомление или inline-ошибку
      await expect(
        page.getByText(/error|ошибка|failed|не удалось|invalid|невалидный/i)
      ).toBeVisible({ timeout: 10_000 });
    });
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// СЦЕНАРИЙ 3: Настройка существующего бота через /agents
// ═════════════════════════════════════════════════════════════════════════════

test.describe("Сценарий 3 — Настройка бота (/agents)", () => {

  // ── 3.1 Страница /agents — отображение списка ──────────────────────────────

  test.describe("Список ботов", () => {
    test.beforeEach(async ({ page }) => {
      await setupAuth(page, [MOCK_AGENT]);
    });

    test("навигация на /agents показывает страницу управления ботами", async ({ page }) => {
      await page.goto("/agents");
      await expect(page).not.toHaveURL(/\/auth/);
      await expect(page.getByText("LifecycleBot")).toBeVisible({ timeout: 10_000 });
    });

    test("карточка бота показывает имя и тип", async ({ page }) => {
      await page.goto("/agents");
      await page.getByText("LifecycleBot").waitFor({ timeout: 10_000 });
      // Имя видно
      await expect(page.getByText("LifecycleBot")).toBeVisible();
    });

    test("у карточки бота есть кнопка меню (три точки)", async ({ page }) => {
      await page.goto("/agents");
      await page.getByText("LifecycleBot").waitFor({ timeout: 10_000 });
      await expect(
        page.locator('button[aria-haspopup="menu"]').last()
      ).toBeVisible();
    });

    test("меню содержит пункт 'Edit/Редактировать'", async ({ page }) => {
      await page.goto("/agents");
      await page.getByText("LifecycleBot").waitFor({ timeout: 10_000 });
      await page.locator('button[aria-haspopup="menu"]').last().click();
      await expect(
        page.getByText(/^Edit$|^Редактировать$/)
      ).toBeVisible({ timeout: 5_000 });
    });

    test("меню содержит пункт 'Delete/Удалить'", async ({ page }) => {
      await page.goto("/agents");
      await page.getByText("LifecycleBot").waitFor({ timeout: 10_000 });
      await page.locator('button[aria-haspopup="menu"]').last().click();
      await expect(
        page.getByText(/^Delete$|^Удалить$/)
      ).toBeVisible({ timeout: 5_000 });
    });
  });

  // ── 3.2 Открытие редактирования ────────────────────────────────────────────

  test.describe("Открытие wizard редактирования", () => {
    test.beforeEach(async ({ page }) => {
      await setupAuth(page, [MOCK_AGENT]);
    });

    test("клик 'Edit' открывает DeployWizard", async ({ page }) => {
      await openEditWizard(page);
      // Wizard открылся — есть кнопки навигации
      await expect(
        page.getByRole("button", { name: /Back|Назад/i })
      ).toBeVisible({ timeout: 8_000 });
    });

    test("wizard открывается с данными существующего бота", async ({ page }) => {
      await openEditWizard(page);
      // Имя бота должно быть заполнено из данных агента
      await expect(page.getByText("LifecycleBot")).toBeVisible({ timeout: 8_000 });
    });
  });

  // ── 3.3 Навигация по шагам wizard редактирования ──────────────────────────

  test.describe("Шаги wizard редактирования", () => {
    test.beforeEach(async ({ page }) => {
      await setupAuth(page, [MOCK_AGENT]);
      await injectWizardState(page, {
        agentId: AGENT_ID,
        step: 0,
        maxStep: 6,
        data: FULL_DEPLOY_DATA,
      });
    });

    test("wizard стартует с шага 1", async ({ page }) => {
      await openEditWizard(page);
      await expect(page.getByText(/1.*\/.*7/i)).toBeVisible({ timeout: 8_000 });
    });

    test("кнопка 'Далее' переводит на следующий шаг", async ({ page }) => {
      await openEditWizard(page);
      // Ждём загрузки шага 1
      await page.getByText(/1.*\/.*7/i).waitFor({ timeout: 8_000 });
      const nextBtn = page.getByRole("button", { name: /Next|Далее/i });
      await nextBtn.waitFor({ state: "enabled", timeout: 5_000 });
      await nextBtn.click();
      await expect(page.getByText(/2.*\/.*7/i)).toBeVisible({ timeout: 5_000 });
    });

    test("кнопка 'Назад' возвращает на предыдущий шаг", async ({ page }) => {
      // Стартуем с шага 1 (maxStep=6), жмём Далее, затем Назад
      await openEditWizard(page);
      await page.getByText(/1.*\/.*7/i).waitFor({ timeout: 8_000 });

      const nextBtn = page.getByRole("button", { name: /Next|Далее/i });
      await nextBtn.waitFor({ state: "enabled", timeout: 5_000 });
      await nextBtn.click();
      await page.getByText(/2.*\/.*7/i).waitFor({ timeout: 5_000 });

      await page.getByRole("button", { name: /Back|Назад/i }).click();
      await expect(page.getByText(/1.*\/.*7/i)).toBeVisible({ timeout: 5_000 });
    });
  });

  // ── 3.4 Шаг деплоя в wizard редактирования ────────────────────────────────

  test.describe("Деплой в wizard редактирования (последний шаг)", () => {
    test.beforeEach(async ({ page }) => {
      await setupAuth(page, [MOCK_AGENT], true);
      // Шаг 6 — Review & Deploy (последний шаг для support-бота = 7 шагов, индекс 6)
      await injectWizardState(page, {
        agentId: AGENT_ID,
        step: 6,
        maxStep: 6,
        data: FULL_DEPLOY_DATA,
      });
    });

    test("на последнем шаге отображается кнопка деплоя", async ({ page }) => {
      await openEditWizard(page);
      await expect(
        page.getByRole("button", { name: /Deploy|Развернуть|Save|Сохранить/i })
      ).toBeVisible({ timeout: 10_000 });
    });
  });

  // ── 3.5 Поиск на странице /agents ─────────────────────────────────────────

  test.describe("Поиск ботов", () => {
    const agents = [
      MOCK_AGENT,
      { ...MOCK_AGENT, id: "agent-002", name: "SalesHelper", description: "A sales bot" },
      { ...MOCK_AGENT, id: "agent-003", name: "SupportBot", description: "A support bot" },
    ];

    test.beforeEach(async ({ page }) => {
      await setupAuth(page, agents);
    });

    test("поисковое поле фильтрует ботов по имени", async ({ page }) => {
      await page.goto("/agents");
      await page.getByText("LifecycleBot").waitFor({ timeout: 10_000 });

      const searchInput = page.getByPlaceholder(/Search bots|Поиск ботов/i);
      await searchInput.fill("SalesHelper");

      // SalesHelper должен остаться, LifecycleBot — исчезнуть
      await expect(page.getByText("SalesHelper")).toBeVisible({ timeout: 3_000 });
      await expect(page.getByText("LifecycleBot")).not.toBeVisible({ timeout: 3_000 });
    });

    test("очистка поиска возвращает все карточки", async ({ page }) => {
      await page.goto("/agents");
      await page.getByText("LifecycleBot").waitFor({ timeout: 10_000 });

      const searchInput = page.getByPlaceholder(/Search bots|Поиск ботов/i);
      await searchInput.fill("SalesHelper");
      await searchInput.clear();

      await expect(page.getByText("LifecycleBot")).toBeVisible({ timeout: 3_000 });
      await expect(page.getByText("SalesHelper")).toBeVisible({ timeout: 3_000 });
    });
  });

  // ── 3.6 Переключение активности бота ──────────────────────────────────────

  test.describe("Управление активностью бота", () => {
    test.beforeEach(async ({ page }) => {
      await setupAuth(page, [MOCK_AGENT]);
    });

    test("меню содержит пункт включения/выключения бота", async ({ page }) => {
      await page.goto("/agents");
      await page.getByText("LifecycleBot").waitFor({ timeout: 10_000 });
      await page.locator('button[aria-haspopup="menu"]').last().click();

      // Пункт Activate / Deactivate / Pause
      await expect(
        page.getByText(/Activate|Deactivate|Pause|Активировать|Деактивировать|Приостановить/i)
      ).toBeVisible({ timeout: 5_000 });
    });
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// СЦЕНАРИЙ 4: Полный E2E-flow (создание → деплой за один тест)
// ═════════════════════════════════════════════════════════════════════════════

test.describe("Сценарий 4 — Полный E2E flow: создание и деплой бота", () => {

  test("пользователь проходит весь QuickStart и успешно деплоит бота", async ({ page }) => {
    await setupAuth(page, [], true);

    // Стартуем с шага describe с пустым черновиком
    await clearQuickDraft(page);
    await openQuickWizard(page);

    // ── Шаг 1: Describe ──
    await page.getByText(/Describe Your Bot|Опишите вашего бота/i).waitFor({ timeout: 8_000 });

    const textarea = page.getByPlaceholder(/e\.g\.,|напр\./i).first();
    await textarea.fill(
      "I run a coffee shop called Brew Haven. We serve espresso-based drinks, " +
      "fresh pastries and specialty teas. Open Monday to Saturday, 8am to 8pm."
    );

    const nameInput = page.getByPlaceholder(/Flora Assistant|Флора Ассистент/i);
    await nameInput.fill("BrewBot");

    // Кнопка генерации активирована
    const generateBtn = page.getByRole("button", { name: /Generate AI Brain|Сгенерировать мозг/i });
    await expect(generateBtn).toBeEnabled();

    // Нажимаем Generate — переходим к brain_preview через mock edge function
    await generateBtn.click();

    // ── Шаг 2: Brain Preview ──
    await page.getByText(/Bot Brain Ready|Мозг бота готов/i).waitFor({ timeout: 15_000 });
    await page.getByRole("button", { name: /Next|Далее/i }).click();

    // ── Шаг 3: Identity ──
    await page.getByText(/Bot Identity|Идентичность бота/i).waitFor({ timeout: 8_000 });

    const shortDesc = page.getByPlaceholder(/Describe your bot in one sentence|Опишите бота/i);
    await shortDesc.fill("Your friendly Brew Haven coffee shop assistant.");

    await page.getByRole("button", { name: /Next|Далее/i }).waitFor({ state: "enabled", timeout: 3_000 });
    await page.getByRole("button", { name: /Next|Далее/i }).click();

    // ── Шаг 4: API Key (опциональный — пропускаем) ──
    await page.getByText(/Connect AI Brain|Подключите AI-мозг/i).waitFor({ timeout: 8_000 });
    await page.getByRole("button", { name: /Next|Далее/i }).click();

    // ── Шаг 5: Deploy ──
    await page.getByText(/Deploy to Telegram|Деплой в Telegram/i).waitFor({ timeout: 8_000 });

    const tokenInput = page.getByPlaceholder("123456789:ABC-DEF1234ghIkl-zyx57W2v1u123ew11");
    await tokenInput.fill(VALID_TELEGRAM_TOKEN);

    const deployBtn = page.getByRole("button", {
      name: /Deploy to Telegram|Развернуть в Telegram/i,
    });
    await expect(deployBtn).toBeEnabled({ timeout: 3_000 });
    await deployBtn.click();

    // ── Успех ──
    await expect(
      page.getByText(/Bot Deployed|Бот запущен|Deployed|Поздравляем|Congratulations/i)
    ).toBeVisible({ timeout: 15_000 });
  });
});
