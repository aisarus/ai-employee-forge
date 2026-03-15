import { describe, it, expect } from "vitest";
import {
  getWizardSteps,
  BOT_TYPE_STEP_PROFILES,
  BOT_TYPE_PRESETS,
  BOT_TYPES,
  DEFAULT_WIZARD_DATA,
} from "../components/wizard/types";

// ── getWizardSteps ────────────────────────────────────────────────────────────

describe("getWizardSteps", () => {
  it("returns only bot_type step when no type selected", () => {
    const steps = getWizardSteps("");
    expect(steps).toEqual(["bot_type"]);
  });

  it("returns minimal steps for support bot", () => {
    const steps = getWizardSteps("support");
    expect(steps).toContain("bot_type");
    expect(steps).toContain("identity");
    expect(steps).toContain("welcome");
    expect(steps).toContain("api_keys");
    expect(steps).toContain("telegram_config");
    expect(steps).toContain("telegram_preview");
    expect(steps).toContain("deploy");
    // Should NOT have advanced steps
    expect(steps).not.toContain("workflow");
    expect(steps).not.toContain("connections");
    expect(steps).not.toContain("data_mapping");
    expect(steps).not.toContain("triggers");
  });

  it("returns minimal steps for faq bot", () => {
    const steps = getWizardSteps("faq");
    expect(steps.length).toBeLessThanOrEqual(8);
    expect(steps).not.toContain("workflow");
  });

  it("returns medium steps for lead bot", () => {
    const steps = getWizardSteps("lead");
    expect(steps).toContain("actions");
    expect(steps).not.toContain("workflow");
    expect(steps).not.toContain("data_mapping");
  });

  it("returns full steps for custom bot", () => {
    const steps = getWizardSteps("custom");
    expect(steps).toContain("workflow");
    expect(steps).toContain("connections");
    expect(steps).toContain("data_mapping");
    expect(steps).toContain("triggers");
    expect(steps).toContain("preview");
  });

  it("always starts with bot_type for known types", () => {
    for (const botType of Object.keys(BOT_TYPE_STEP_PROFILES)) {
      const steps = getWizardSteps(botType);
      expect(steps[0]).toBe("bot_type");
    }
  });

  it("always ends with deploy for all known non-empty types", () => {
    const typesWithFullFlow = ["support", "faq", "lead", "sales", "booking", "order", "custom"];
    for (const botType of typesWithFullFlow) {
      const steps = getWizardSteps(botType);
      expect(steps[steps.length - 1]).toBe("deploy");
    }
  });

  it("falls back to custom profile for unknown types", () => {
    const steps = getWizardSteps("unknown_type_xyz");
    // Should use custom profile (most permissive)
    expect(steps).toContain("deploy");
  });

  it("simple bots have fewer steps than custom", () => {
    const supportSteps = getWizardSteps("support");
    const customSteps = getWizardSteps("custom");
    expect(supportSteps.length).toBeLessThan(customSteps.length);
  });
});

// ── BOT_TYPE_PRESETS ──────────────────────────────────────────────────────────

describe("BOT_TYPE_PRESETS", () => {
  const expectedTypes = ["support", "faq", "sales", "booking", "lead", "order", "custom"];

  it("has presets for all expected bot types", () => {
    for (const type of expectedTypes) {
      expect(BOT_TYPE_PRESETS[type]).toBeDefined();
    }
  });

  it("every preset has required fields", () => {
    for (const [type, preset] of Object.entries(BOT_TYPE_PRESETS)) {
      expect(preset.welcome_message_key,  `${type} missing welcome_message_key`).toBeTruthy();
      expect(preset.fallback_message_key, `${type} missing fallback_message_key`).toBeTruthy();
      expect(Array.isArray(preset.bot_actions),       `${type} bot_actions not array`).toBe(true);
      expect(Array.isArray(preset.starter_buttons),   `${type} starter_buttons not array`).toBe(true);
      expect(Array.isArray(preset.data_fields),       `${type} data_fields not array`).toBe(true);
      expect(Array.isArray(preset.telegram_commands), `${type} telegram_commands not array`).toBe(true);
    }
  });

  it("booking preset has data_fields for name, phone, date", () => {
    const { data_fields } = BOT_TYPE_PRESETS.booking;
    const fieldNames = data_fields.map((f) => f.field_name);
    expect(fieldNames).toContain("name");
    expect(fieldNames).toContain("phone");
    expect(fieldNames).toContain("date");
  });

  it("lead preset has data_fields for name, phone, company", () => {
    const { data_fields } = BOT_TYPE_PRESETS.lead;
    const fieldNames = data_fields.map((f) => f.field_name);
    expect(fieldNames).toContain("name");
    expect(fieldNames).toContain("phone");
    expect(fieldNames).toContain("company");
  });

  it("order preset has data_fields for name, phone, address", () => {
    const { data_fields } = BOT_TYPE_PRESETS.order;
    const fieldNames = data_fields.map((f) => f.field_name);
    expect(fieldNames).toContain("name");
    expect(fieldNames).toContain("phone");
    expect(fieldNames).toContain("address");
  });

  it("all telegram_commands start with /", () => {
    for (const [type, preset] of Object.entries(BOT_TYPE_PRESETS)) {
      for (const cmd of preset.telegram_commands) {
        expect(cmd.command.startsWith("/"), `${type}: command '${cmd.command}' must start with /`).toBe(true);
      }
    }
  });

  it("all telegram_commands have non-empty descriptions", () => {
    for (const [type, preset] of Object.entries(BOT_TYPE_PRESETS)) {
      for (const cmd of preset.telegram_commands) {
        expect(cmd.description.trim().length, `${type}: command '${cmd.command}' has empty description`).toBeGreaterThan(0);
      }
    }
  });
});

// ── BOT_TYPES ─────────────────────────────────────────────────────────────────

describe("BOT_TYPES", () => {
  it("every BOT_TYPE has a corresponding preset", () => {
    for (const bt of BOT_TYPES) {
      expect(BOT_TYPE_PRESETS[bt.id], `No preset for bot type '${bt.id}'`).toBeDefined();
    }
  });

  it("every BOT_TYPE has id, icon, label, desc", () => {
    for (const bt of BOT_TYPES) {
      expect(bt.id.trim()).toBeTruthy();
      expect(bt.icon.trim()).toBeTruthy();
      expect(bt.label.trim()).toBeTruthy();
      expect(bt.desc.trim()).toBeTruthy();
    }
  });
});

// ── DEFAULT_WIZARD_DATA ───────────────────────────────────────────────────────

describe("DEFAULT_WIZARD_DATA", () => {
  it("has openai_api_key field", () => {
    expect(DEFAULT_WIZARD_DATA).toHaveProperty("openai_api_key");
    expect(DEFAULT_WIZARD_DATA.openai_api_key).toBe("");
  });

  it("has telegram_bot_token field", () => {
    expect(DEFAULT_WIZARD_DATA).toHaveProperty("telegram_bot_token");
    expect(DEFAULT_WIZARD_DATA.telegram_bot_token).toBe("");
  });

  it("has empty bot_type by default", () => {
    expect(DEFAULT_WIZARD_DATA.bot_type).toBe("");
  });

  it("has default /start and /help commands", () => {
    const cmds = DEFAULT_WIZARD_DATA.telegram_commands.map((c) => c.command);
    expect(cmds).toContain("/start");
    expect(cmds).toContain("/help");
  });
});
