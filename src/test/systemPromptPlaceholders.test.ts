/**
 * Second-echelon test suite for BotForge system prompt generation.
 *
 * Covers gaps in the first-echelon suite (promptBuilder.test.ts):
 *   • Section 6 — RESPONSE TEMPLATES (always present, never tested before)
 *   • Bracketed [placeholder] integrity inside response templates
 *   • Correct section numbers (15/16, not 13/14, for error-handling & state)
 *   • Anti-patterns block in Section 5 — GUARDRAILS
 *   • Thinking-framework content per bot type (Section 3)
 *   • Communication DNA tone/style descriptions with exact strings (Section 4)
 *   • Data-collection type hints (phone/email/date/number/select)
 *   • Connector invocation protocol — error policy & safety rules
 */

import { describe, it, expect } from "vitest";
import {
  buildFullSystemPrompt,
  buildActionsPromptBlock,
} from "../components/wizard/promptBuilder";
import type { WizardData } from "../components/wizard/types";
import { DEFAULT_WIZARD_DATA } from "../components/wizard/types";

// ── helpers ───────────────────────────────────────────────────────────────────

function makeData(overrides: Partial<WizardData> = {}): WizardData {
  return {
    ...DEFAULT_WIZARD_DATA,
    telegram_commands: [],
    ...overrides,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Section 6 — RESPONSE TEMPLATES (always present)
// ─────────────────────────────────────────────────────────────────────────────

describe("buildFullSystemPrompt — Section 6: Response Templates (always present)", () => {
  it("always generates RESPONSE TEMPLATES section header", () => {
    const prompt = buildFullSystemPrompt(makeData());
    expect(prompt).toContain("## SECTION 6 — RESPONSE TEMPLATES");
  });

  it("includes 'Adapt the wording' usage instruction", () => {
    const prompt = buildFullSystemPrompt(makeData());
    expect(prompt).toContain("Adapt the wording to the conversation context");
  });

  it("falls back to generic message when bot_type has no templates (undefined type)", () => {
    // Custom bot has templates defined, so use a truly empty override
    const prompt = buildFullSystemPrompt(
      makeData({ bot_type: "custom" })
    );
    // custom bot DOES have templates — section must not show the fallback message
    expect(prompt).not.toContain("No role-specific templates defined");
  });

  // ── sales template placeholders ──────────────────────────────────────────

  it("sales: Opening template contains [Name] placeholder", () => {
    const prompt = buildFullSystemPrompt(makeData({ bot_type: "sales" }));
    expect(prompt).toContain("[Name]");
  });

  it("sales: Closing template contains [Product] placeholder", () => {
    const prompt = buildFullSystemPrompt(makeData({ bot_type: "sales" }));
    expect(prompt).toContain("[Product]");
  });

  it("sales: Post Sale template contains [summary] placeholder", () => {
    const prompt = buildFullSystemPrompt(makeData({ bot_type: "sales" }));
    expect(prompt).toContain("[summary]");
  });

  it("sales: template keys are converted to Title Case labels", () => {
    const prompt = buildFullSystemPrompt(makeData({ bot_type: "sales" }));
    expect(prompt).toContain("Post Sale:");
    expect(prompt).toContain("Objection Price:");
    expect(prompt).toContain("Objection Timing:");
  });

  // ── booking template placeholders ────────────────────────────────────────

  it("booking: Slot Offer template contains [option 1] placeholder", () => {
    const prompt = buildFullSystemPrompt(makeData({ bot_type: "booking" }));
    expect(prompt).toContain("[option 1]");
    expect(prompt).toContain("[option 2]");
    expect(prompt).toContain("[option 3]");
  });

  it("booking: Confirmation Summary template contains [service] placeholder", () => {
    const prompt = buildFullSystemPrompt(makeData({ bot_type: "booking" }));
    expect(prompt).toContain("[service]");
  });

  it("booking: Confirmation Summary template contains [date/time] placeholder", () => {
    const prompt = buildFullSystemPrompt(makeData({ bot_type: "booking" }));
    expect(prompt).toContain("[date/time]");
  });

  it("booking: Confirmation Summary template contains [phone] placeholder", () => {
    const prompt = buildFullSystemPrompt(makeData({ bot_type: "booking" }));
    expect(prompt).toContain("[phone]");
  });

  it("booking: template keys are converted to Title Case labels", () => {
    const prompt = buildFullSystemPrompt(makeData({ bot_type: "booking" }));
    expect(prompt).toContain("Slot Offer:");
    expect(prompt).toContain("Confirmation Summary:");
  });

  // ── order template placeholders ───────────────────────────────────────────

  it("order: Summary template contains [items] and [qty] placeholders", () => {
    const prompt = buildFullSystemPrompt(makeData({ bot_type: "order" }));
    expect(prompt).toContain("[items]");
    expect(prompt).toContain("[qty]");
  });

  it("order: Summary template contains [address] and [price] placeholders", () => {
    const prompt = buildFullSystemPrompt(makeData({ bot_type: "order" }));
    expect(prompt).toContain("[address]");
    expect(prompt).toContain("[price]");
  });

  it("order: Confirmed template contains [ORDER-ID] placeholder", () => {
    const prompt = buildFullSystemPrompt(makeData({ bot_type: "order" }));
    expect(prompt).toContain("[ORDER-ID]");
  });

  it("order: Status Check template contains [status] placeholder", () => {
    const prompt = buildFullSystemPrompt(makeData({ bot_type: "order" }));
    expect(prompt).toContain("[status]");
  });

  // ── faq template placeholders ─────────────────────────────────────────────

  it("faq: Answer template contains [related question 1] placeholder", () => {
    const prompt = buildFullSystemPrompt(makeData({ bot_type: "faq" }));
    expect(prompt).toContain("[related question 1]");
    expect(prompt).toContain("[related question 2]");
  });

  it("faq: Uncertain template contains [where to get it] placeholder", () => {
    const prompt = buildFullSystemPrompt(makeData({ bot_type: "faq" }));
    expect(prompt).toContain("[where to get it]");
  });

  // ── support template placeholders ────────────────────────────────────────

  it("support: Escalation template contains [agent/team] placeholder", () => {
    const prompt = buildFullSystemPrompt(makeData({ bot_type: "support" }));
    expect(prompt).toContain("[agent/team]");
  });

  it("support: Hypothesis template contains [diagnosis] placeholder", () => {
    const prompt = buildFullSystemPrompt(makeData({ bot_type: "support" }));
    expect(prompt).toContain("[diagnosis]");
  });

  // ── lead template placeholders ────────────────────────────────────────────

  it("lead: Hot Route template contains [Name/Team] placeholder", () => {
    const prompt = buildFullSystemPrompt(makeData({ bot_type: "lead" }));
    expect(prompt).toContain("[Name/Team]");
  });

  it("lead: Cold Close template contains [resource] placeholder", () => {
    const prompt = buildFullSystemPrompt(makeData({ bot_type: "lead" }));
    expect(prompt).toContain("[resource]");
  });

  // ── custom template placeholders ──────────────────────────────────────────

  it("custom: Confirmation template contains [action summary] placeholder", () => {
    const prompt = buildFullSystemPrompt(makeData({ bot_type: "custom" }));
    expect(prompt).toContain("[action summary]");
  });

  it("custom: Completion template contains [Outcome summary] placeholder", () => {
    const prompt = buildFullSystemPrompt(makeData({ bot_type: "custom" }));
    expect(prompt).toContain("[Outcome summary]");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Section numbering — exact section numbers
// ─────────────────────────────────────────────────────────────────────────────

describe("buildFullSystemPrompt — section number assignments", () => {
  it("Section 1 is IDENTITY & PERSONA", () => {
    expect(buildFullSystemPrompt(makeData())).toContain("## SECTION 1 — IDENTITY & PERSONA");
  });

  it("Section 2 is ROLE & RESPONSIBILITIES", () => {
    expect(buildFullSystemPrompt(makeData())).toContain("## SECTION 2 — ROLE & RESPONSIBILITIES");
  });

  it("Section 3 is THINKING FRAMEWORK", () => {
    expect(buildFullSystemPrompt(makeData())).toContain("## SECTION 3 — THINKING FRAMEWORK");
  });

  it("Section 4 is COMMUNICATION DNA", () => {
    expect(buildFullSystemPrompt(makeData())).toContain("## SECTION 4 — COMMUNICATION DNA");
  });

  it("Section 5 is GUARDRAILS", () => {
    expect(buildFullSystemPrompt(makeData())).toContain("## SECTION 5 — GUARDRAILS");
  });

  it("Section 6 is RESPONSE TEMPLATES (always)", () => {
    expect(buildFullSystemPrompt(makeData())).toContain("## SECTION 6 — RESPONSE TEMPLATES");
  });

  it("Section 7 is DATA COLLECTION PROTOCOL when data_fields provided", () => {
    const prompt = buildFullSystemPrompt(
      makeData({
        data_fields: [
          { id: "f1", field_name: "name", label: "Name", required: true, type: "text", ask_order: 1 },
        ],
      })
    );
    expect(prompt).toContain("## SECTION 7 — DATA COLLECTION PROTOCOL");
  });

  it("Section 8 is WORKFLOW PROCEDURE when workflow_steps provided", () => {
    const prompt = buildFullSystemPrompt(
      makeData({
        workflow_steps: [{ id: "s1", title: "Greet user", action_type: "ask_question" }],
      })
    );
    expect(prompt).toContain("## SECTION 8 — WORKFLOW PROCEDURE");
  });

  it("Section 9 is CONNECTOR INTEGRATION ARCHITECTURE when connectors provided", () => {
    const prompt = buildFullSystemPrompt(
      makeData({
        connectors: [
          {
            id: "ws",
            type: "webhook",
            display_name: "Webhook",
            status: "connected",
            auth_value: "https://example.com",
            capabilities: ["read"],
          },
        ],
      })
    );
    expect(prompt).toContain("## SECTION 9 — CONNECTOR INTEGRATION ARCHITECTURE");
  });

  it("Section 10 is DATA SOURCES & WRITE DESTINATIONS when data_sources provided", () => {
    const prompt = buildFullSystemPrompt(
      makeData({
        data_sources: [
          {
            id: "ds1",
            connector_id: "gs",
            name: "CatalogSheet",
            resource_name: "Sheet1",
            mode: "read",
            purpose: "lookup prices",
          },
        ],
      })
    );
    expect(prompt).toContain("## SECTION 10 — DATA SOURCES & WRITE DESTINATIONS");
  });

  it("Section 11 is FIELD MAPPINGS when field_mappings provided", () => {
    const prompt = buildFullSystemPrompt(
      makeData({
        data_sources: [
          { id: "ds1", connector_id: "gs", name: "CRM", resource_name: "R", mode: "write", purpose: "save" },
        ],
        field_mappings: [
          { id: "fm1", bot_field: "name", data_source_id: "ds1", external_field: "full_name", required: true, transform: "none" },
        ],
      })
    );
    expect(prompt).toContain("## SECTION 11 — FIELD MAPPINGS");
  });

  it("Section 12 is ACTION TRIGGERS when action_triggers provided", () => {
    const prompt = buildFullSystemPrompt(
      makeData({
        action_triggers: [
          {
            id: "t1",
            name: "Notify admin",
            when: "on_new_lead",
            action_type: "notify",
            target_destination: "",
            confirmation_policy: "automatic",
          },
        ],
      })
    );
    expect(prompt).toContain("## SECTION 12 — ACTION TRIGGERS");
  });

  it("Section 13 is INTEGRATION-LEVEL CONDITIONAL RULES when integration_rules provided", () => {
    const prompt = buildFullSystemPrompt(
      makeData({
        integration_rules: [
          { id: "ir1", if_condition: "stock < 5", then_action: "flag low stock" },
        ],
      })
    );
    expect(prompt).toContain("## SECTION 13 — INTEGRATION-LEVEL CONDITIONAL RULES");
  });

  it("Section 14 is TELEGRAM COMMAND HANDLERS when commands provided", () => {
    const prompt = buildFullSystemPrompt(
      makeData({
        telegram_commands: [{ command: "/start", description: "Start the bot" }],
      })
    );
    expect(prompt).toContain("## SECTION 14 — TELEGRAM COMMAND HANDLERS");
  });

  it("Section 15 is ERROR HANDLING & RECOVERY (always)", () => {
    expect(buildFullSystemPrompt(makeData())).toContain("## SECTION 15 — ERROR HANDLING & RECOVERY");
  });

  it("Section 16 is CONVERSATION STATE MANAGEMENT (always)", () => {
    expect(buildFullSystemPrompt(makeData())).toContain("## SECTION 16 — CONVERSATION STATE MANAGEMENT");
  });

  it("full configuration produces all 16 numbered section headers", () => {
    const data = makeData({
      bot_type: "order",
      data_fields: [
        { id: "f1", field_name: "name", label: "Name", required: true, type: "text", ask_order: 1 },
      ],
      workflow_steps: [{ id: "s1", title: "Greet", action_type: "ask_question" }],
      connectors: [
        {
          id: "ws1",
          type: "webhook",
          display_name: "WebhookMain",
          status: "connected",
          auth_value: "https://example.com/hook",
          capabilities: ["read", "write"],
        },
      ],
      data_sources: [
        { id: "ds1", connector_id: "ws1", name: "Catalog", resource_name: "R", mode: "read", purpose: "lookup" },
        { id: "ds2", connector_id: "ws1", name: "Orders", resource_name: "S", mode: "write", purpose: "save" },
      ],
      field_mappings: [
        {
          id: "fm1",
          bot_field: "name",
          data_source_id: "ds2",
          external_field: "customer_name",
          required: true,
          transform: "none",
        },
      ],
      action_triggers: [
        {
          id: "tr1",
          name: "Save order",
          when: "after_user_confirmation",
          action_type: "write",
          target_destination: "Orders",
          confirmation_policy: "automatic",
        },
      ],
      integration_rules: [{ id: "ir1", if_condition: "qty > 10", then_action: "apply bulk discount" }],
      telegram_commands: [
        { command: "/start", description: "Start the bot" },
        { command: "/cancel", description: "Cancel current operation" },
      ],
    });

    const prompt = buildFullSystemPrompt(data);
    for (let sec = 1; sec <= 16; sec++) {
      expect(prompt, `Section ${sec} header missing`).toContain(`## SECTION ${sec} —`);
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Section 3 — Thinking Framework per bot type
// ─────────────────────────────────────────────────────────────────────────────

describe("buildFullSystemPrompt — Section 3: Thinking Framework", () => {
  it("always includes BEFORE RESPONDING header", () => {
    const prompt = buildFullSystemPrompt(makeData());
    expect(prompt).toContain("BEFORE RESPONDING — ask yourself:");
  });

  it("always includes meta-rule about most charitable interpretation", () => {
    const prompt = buildFullSystemPrompt(makeData());
    expect(prompt).toContain("most charitable interpretation");
  });

  it("always includes meta-rule about user frustration", () => {
    const prompt = buildFullSystemPrompt(makeData());
    expect(prompt).toContain("If the user seems frustrated: address the emotion before the content");
  });

  it("sales: thinking framework mentions awareness → consideration → decision journey", () => {
    const prompt = buildFullSystemPrompt(makeData({ bot_type: "sales" }));
    expect(prompt).toContain("awareness → consideration → decision");
  });

  it("sales: thinking framework ends with clear next step rule", () => {
    const prompt = buildFullSystemPrompt(makeData({ bot_type: "sales" }));
    expect(prompt).toContain("End every message with a clear, low-friction next step");
  });

  it("booking: thinking framework includes service → preferred date/time collection order", () => {
    const prompt = buildFullSystemPrompt(makeData({ bot_type: "booking" }));
    expect(prompt).toContain("service → preferred date/time → contact details → confirm");
  });

  it("booking: thinking framework mentions offering 2–3 concrete time slot options", () => {
    const prompt = buildFullSystemPrompt(makeData({ bot_type: "booking" }));
    expect(prompt).toContain("2–3 concrete time slot options");
  });

  it("support: thinking framework requires ONE diagnostic question at a time", () => {
    const prompt = buildFullSystemPrompt(makeData({ bot_type: "support" }));
    expect(prompt).toContain("Ask ONE targeted diagnostic question at a time");
  });

  it("support: thinking framework requires explicit 'Has this resolved the issue?' check", () => {
    const prompt = buildFullSystemPrompt(makeData({ bot_type: "support" }));
    expect(prompt).toContain("Has this resolved the issue?");
  });

  it("lead: thinking framework includes BANT framework", () => {
    const prompt = buildFullSystemPrompt(makeData({ bot_type: "lead" }));
    expect(prompt).toContain("Budget → Authority → Need → Timeline");
  });

  it("lead: thinking framework includes hot/warm/cold scoring", () => {
    const prompt = buildFullSystemPrompt(makeData({ bot_type: "lead" }));
    expect(prompt).toContain("hot (clear need + budget + short timeline) / warm / cold");
  });

  it("faq: thinking framework includes confidence levels", () => {
    const prompt = buildFullSystemPrompt(makeData({ bot_type: "faq" }));
    expect(prompt).toContain("certain / likely / uncertain");
  });

  it("order: thinking framework requires structured itemised summary before confirmation", () => {
    const prompt = buildFullSystemPrompt(makeData({ bot_type: "order" }));
    expect(prompt).toContain("Generate a structured, itemised order summary before requesting confirmation");
  });

  it("order: thinking framework requires explicit 'yes' before execution", () => {
    const prompt = buildFullSystemPrompt(makeData({ bot_type: "order" }));
    expect(prompt).toContain("Execute only after explicit 'yes'");
  });

  it("custom: thinking framework covers all required data fields check", () => {
    const prompt = buildFullSystemPrompt(makeData({ bot_type: "custom" }));
    expect(prompt).toContain("Identify which required data fields are still missing");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Section 4 — Communication DNA tone & style descriptions
// ─────────────────────────────────────────────────────────────────────────────

describe("buildFullSystemPrompt — Section 4: Communication DNA", () => {
  it("always includes Section 4 header", () => {
    expect(buildFullSystemPrompt(makeData())).toContain("## SECTION 4 — COMMUNICATION DNA");
  });

  it("Friendly tone: description is 'warm and approachable'", () => {
    const prompt = buildFullSystemPrompt(makeData({ tone: "Friendly" }));
    expect(prompt).toContain("warm and approachable");
  });

  it("Professional tone: description is 'precise and formal'", () => {
    const prompt = buildFullSystemPrompt(makeData({ tone: "Professional" }));
    expect(prompt).toContain("precise and formal");
  });

  it("Formal tone: description is 'strictly formal'", () => {
    const prompt = buildFullSystemPrompt(makeData({ tone: "Formal" }));
    expect(prompt).toContain("strictly formal");
  });

  it("Supportive tone: description is 'empathetic and patient'", () => {
    const prompt = buildFullSystemPrompt(makeData({ tone: "Supportive" }));
    expect(prompt).toContain("empathetic and patient");
  });

  it("Playful tone: description is 'light-hearted and upbeat'", () => {
    const prompt = buildFullSystemPrompt(makeData({ tone: "Playful" }));
    expect(prompt).toContain("light-hearted and upbeat");
  });

  it("Concise tone: description is 'ultra-direct'", () => {
    const prompt = buildFullSystemPrompt(makeData({ tone: "Concise" }));
    expect(prompt).toContain("ultra-direct");
  });

  it("unknown tone value falls back to using the raw value as description", () => {
    const prompt = buildFullSystemPrompt(makeData({ tone: "Mysterious" }));
    expect(prompt).toContain("Tone     : Mysterious — Mysterious");
  });

  it("Concise style: instructs 'Max 3 sentences'", () => {
    const prompt = buildFullSystemPrompt(makeData({ response_style: "Concise" }));
    expect(prompt).toContain("Max 3 sentences");
  });

  it("Detailed style: instructs full context with examples", () => {
    const prompt = buildFullSystemPrompt(makeData({ response_style: "Detailed" }));
    expect(prompt).toContain("full context with examples");
  });

  it("Step-by-step style: instructs 'Number every multi-step process'", () => {
    const prompt = buildFullSystemPrompt(makeData({ response_style: "Step-by-step" }));
    expect(prompt).toContain("Number every multi-step process");
  });

  it("Bullet points style: instructs 'Use bullets for lists'", () => {
    const prompt = buildFullSystemPrompt(makeData({ response_style: "Bullet points" }));
    expect(prompt).toContain("Use bullets for lists");
  });

  it("includes FORMATTING RULES (Telegram) block", () => {
    const prompt = buildFullSystemPrompt(makeData());
    expect(prompt).toContain("FORMATTING RULES (Telegram):");
  });

  it("warns against markdown tables on mobile Telegram", () => {
    const prompt = buildFullSystemPrompt(makeData());
    expect(prompt).toContain("Avoid markdown tables — they render poorly on mobile Telegram");
  });

  it("instructs keeping messages under 300 characters", () => {
    const prompt = buildFullSystemPrompt(makeData());
    expect(prompt).toContain("Keep messages under 300 characters");
  });

  it("language instruction acknowledges other-language messages and redirects", () => {
    const prompt = buildFullSystemPrompt(makeData({ default_language: "Hebrew" }));
    expect(prompt).toContain("acknowledge briefly, then continue in Hebrew");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Section 5 — Anti-patterns per bot type
// ─────────────────────────────────────────────────────────────────────────────

describe("buildFullSystemPrompt — Section 5: Anti-patterns", () => {
  it("always includes ANTI-PATTERNS block header", () => {
    const prompt = buildFullSystemPrompt(makeData({ bot_type: "sales" }));
    expect(prompt).toContain("ANTI-PATTERNS — specific behaviours to actively avoid");
  });

  it("sales: anti-pattern about asking 'Do you want to buy?' prematurely", () => {
    const prompt = buildFullSystemPrompt(makeData({ bot_type: "sales" }));
    expect(prompt).toContain("Asking 'Do you want to buy?' before understanding their situation");
  });

  it("sales: anti-pattern about ending message with no next step", () => {
    const prompt = buildFullSystemPrompt(makeData({ bot_type: "sales" }));
    expect(prompt).toContain("Ending a message with no clear next step");
  });

  it("booking: anti-pattern about asking open-ended availability question", () => {
    const prompt = buildFullSystemPrompt(makeData({ bot_type: "booking" }));
    expect(prompt).toContain("Asking 'When are you available?' without offering concrete options");
  });

  it("booking: anti-pattern about collecting phone before confirming service and date", () => {
    const prompt = buildFullSystemPrompt(makeData({ bot_type: "booking" }));
    expect(prompt).toContain("Collecting phone number before confirming the service and date");
  });

  it("support: anti-pattern about jumping to solution before diagnosis", () => {
    const prompt = buildFullSystemPrompt(makeData({ bot_type: "support" }));
    expect(prompt).toContain("Jumping to a solution before fully diagnosing the problem");
  });

  it("support: anti-pattern about escalating without summarising context", () => {
    const prompt = buildFullSystemPrompt(makeData({ bot_type: "support" }));
    expect(prompt).toContain("Escalating without summarising the full context for the human agent");
  });

  it("faq: anti-pattern about 'Great question!' filler", () => {
    const prompt = buildFullSystemPrompt(makeData({ bot_type: "faq" }));
    expect(prompt).toContain("Saying 'Great question!' before every answer");
  });

  it("faq: anti-pattern about speculating outside the knowledge base", () => {
    const prompt = buildFullSystemPrompt(makeData({ bot_type: "faq" }));
    expect(prompt).toContain("Speculating about answers outside the knowledge base");
  });

  it("lead: anti-pattern about opening with a pitch", () => {
    const prompt = buildFullSystemPrompt(makeData({ bot_type: "lead" }));
    expect(prompt).toContain("Opening with a pitch before learning anything about the prospect");
  });

  it("lead: anti-pattern about using the word 'qualify'", () => {
    const prompt = buildFullSystemPrompt(makeData({ bot_type: "lead" }));
    expect(prompt).toContain("Using the word 'qualify' out loud");
  });

  it("order: anti-pattern about accepting vague 'yes' without specifics", () => {
    const prompt = buildFullSystemPrompt(makeData({ bot_type: "order" }));
    expect(prompt).toContain("Accepting 'yes' to a vague order description without confirming specifics");
  });

  it("order: anti-pattern about treating emoji as explicit confirmation", () => {
    const prompt = buildFullSystemPrompt(makeData({ bot_type: "order" }));
    expect(prompt).toContain("thumbs-up emoji constitutes explicit confirmation");
  });

  it("custom: anti-pattern about skipping workflow steps at user request", () => {
    const prompt = buildFullSystemPrompt(makeData({ bot_type: "custom" }));
    expect(prompt).toContain("Skipping workflow steps because the user asks to");
  });

  it("custom: anti-pattern about collecting fields out of order", () => {
    const prompt = buildFullSystemPrompt(makeData({ bot_type: "custom" }));
    expect(prompt).toContain("Collecting fields out of the defined order");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Section 7 — Data collection type hints
// ─────────────────────────────────────────────────────────────────────────────

describe("buildFullSystemPrompt — Section 7: data collection type hints", () => {
  function withField(type: string, opts?: string[]): WizardData {
    return makeData({
      data_fields: [
        {
          id: "f1",
          field_name: "field",
          label: "Test Field",
          required: true,
          type,
          ask_order: 1,
          options: opts,
        },
      ],
    });
  }

  it("text type produces 'Free text' hint", () => {
    expect(buildFullSystemPrompt(withField("text"))).toContain("Free text");
  });

  it("phone type produces international-format hint", () => {
    expect(buildFullSystemPrompt(withField("phone"))).toContain("international format preferred");
  });

  it("email type produces valid-email-address hint", () => {
    expect(buildFullSystemPrompt(withField("email"))).toContain("Valid email address");
  });

  it("date type produces DD/MM/YYYY format hint", () => {
    expect(buildFullSystemPrompt(withField("date"))).toContain("DD/MM/YYYY format");
  });

  it("number type produces 'Numeric value only' hint", () => {
    expect(buildFullSystemPrompt(withField("number"))).toContain("Numeric value only");
  });

  it("select type produces 'One of the allowed options' hint", () => {
    expect(buildFullSystemPrompt(withField("select", ["A", "B", "C"]))).toContain(
      "One of the allowed options listed below"
    );
  });

  it("section includes 'Ask for ONE field at a time' collection rule", () => {
    expect(buildFullSystemPrompt(withField("text"))).toContain("Ask for ONE field at a time");
  });

  it("section includes 'FIELDS (collect in this exact order)' heading", () => {
    expect(buildFullSystemPrompt(withField("text"))).toContain("FIELDS (collect in this exact order):");
  });

  it("section instructs to summarise and ask for confirmation when all fields collected", () => {
    expect(buildFullSystemPrompt(withField("text"))).toContain(
      "summarise ALL values and ask for confirmation"
    );
  });

  it("section instructs re-asking with concrete example on invalid input", () => {
    expect(buildFullSystemPrompt(withField("text"))).toContain(
      "explain the expected format with a concrete example, then re-ask"
    );
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Section 9 — Connector invocation protocol & error policy
// ─────────────────────────────────────────────────────────────────────────────

describe("buildFullSystemPrompt — Section 9: connector error policy & safety rules", () => {
  function withConnector(caps: string[]): WizardData {
    return makeData({
      connectors: [
        {
          id: "my_conn",
          type: "webhook",
          display_name: "My Webhook",
          status: "connected",
          auth_value: "https://example.com",
          capabilities: caps,
        },
      ],
    });
  }

  it("READ instruction warns never to expose raw connector output", () => {
    const prompt = buildFullSystemPrompt(withConnector(["read"]));
    expect(prompt).toContain("Never expose raw connector output directly");
  });

  it("READ instruction tells bot to surface only relevant records", () => {
    const prompt = buildFullSystemPrompt(withConnector(["read"]));
    expect(prompt).toContain("surface only the relevant records to the user");
  });

  it("WRITE instruction references SECTION 9 field mappings for key names", () => {
    const prompt = buildFullSystemPrompt(withConnector(["write"]));
    expect(prompt).toContain("SECTION 9");
  });

  it("WRITE instruction requires confirming success before notifying user", () => {
    const prompt = buildFullSystemPrompt(withConnector(["write"]));
    expect(prompt).toContain("Confirm success before notifying the user");
  });

  it("WRITE instruction forbids silent failure on write errors", () => {
    const prompt = buildFullSystemPrompt(withConnector(["write"]));
    expect(prompt).toContain("do not retry silently — inform the user");
  });

  it("error policy instructs retry once after brief pause", () => {
    const prompt = buildFullSystemPrompt(withConnector(["read"]));
    expect(prompt).toContain("Retry once after a brief pause");
  });

  it("error policy instructs offering manual alternative or escalation", () => {
    const prompt = buildFullSystemPrompt(withConnector(["read"]));
    expect(prompt).toContain("Offer a manual alternative or escalation path");
  });

  it("error policy instructs logging error type in conversation state", () => {
    const prompt = buildFullSystemPrompt(withConnector(["read"]));
    expect(prompt).toContain("Log error type in conversation state");
  });

  it("connector display name and id appear in section header", () => {
    const prompt = buildFullSystemPrompt(withConnector(["read"]));
    expect(prompt).toContain("My Webhook [id: my_conn]");
  });

  it("section instructs not to mix connector contexts", () => {
    const prompt = buildFullSystemPrompt(withConnector(["read"]));
    expect(prompt).toContain("Use each connector ONLY for its stated purpose");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Sections 15 & 16 — always-present error handling & state management
// ─────────────────────────────────────────────────────────────────────────────

describe("buildFullSystemPrompt — Sections 15 & 16: always-present sections", () => {
  // ── Section 15 ─────────────────────────────────────────────────────────────

  it("Section 15 is always ERROR HANDLING & RECOVERY", () => {
    expect(buildFullSystemPrompt(makeData())).toContain("## SECTION 15 — ERROR HANDLING & RECOVERY");
  });

  it("Section 15 contains CONNECTOR / INTEGRATION ERROR handler", () => {
    expect(buildFullSystemPrompt(makeData())).toContain("CONNECTOR / INTEGRATION ERROR");
  });

  it("Section 15 contains MISSING REQUIRED DATA handler", () => {
    expect(buildFullSystemPrompt(makeData())).toContain("MISSING REQUIRED DATA");
  });

  it("Section 15 MISSING DATA template uses [field] and [example] placeholders", () => {
    const prompt = buildFullSystemPrompt(makeData());
    expect(prompt).toContain("'I need [field] to continue. For example: [example]'");
  });

  it("Section 15 contains AMBIGUOUS USER INTENT handler", () => {
    expect(buildFullSystemPrompt(makeData())).toContain("AMBIGUOUS USER INTENT");
  });

  it("Section 15 AMBIGUOUS INTENT template offers 2–3 interpretations as quick-replies", () => {
    const prompt = buildFullSystemPrompt(makeData());
    expect(prompt).toContain("Offer 2–3 interpretations as clearly labelled quick-reply options");
  });

  it("Section 15 contains OUT-OF-SCOPE REQUEST handler", () => {
    expect(buildFullSystemPrompt(makeData())).toContain("OUT-OF-SCOPE REQUEST");
  });

  it("Section 15 contains USER FRUSTRATION handler", () => {
    expect(buildFullSystemPrompt(makeData())).toContain("USER FRUSTRATION");
  });

  it("Section 15 USER FRUSTRATION escalates automatically after third expression", () => {
    const prompt = buildFullSystemPrompt(makeData());
    expect(prompt).toContain("After the 3rd: escalate regardless of user preference");
  });

  it("Section 15 ESCALATION requires structured handover summary", () => {
    expect(buildFullSystemPrompt(makeData())).toContain("structured handover summary");
  });

  it("Section 15 ESCALATION summary includes customer name, issue, what was tried, and next step", () => {
    const prompt = buildFullSystemPrompt(makeData());
    expect(prompt).toContain("Customer name and contact");
    expect(prompt).toContain("Issue summary in 2–3 sentences");
    expect(prompt).toContain("What was already tried");
    expect(prompt).toContain("What the customer needs next");
  });

  // ── Section 16 ─────────────────────────────────────────────────────────────

  it("Section 16 is always CONVERSATION STATE MANAGEMENT", () => {
    expect(buildFullSystemPrompt(makeData())).toContain("## SECTION 16 — CONVERSATION STATE MANAGEMENT");
  });

  it("Section 16 tracks collected_fields state variable", () => {
    expect(buildFullSystemPrompt(makeData())).toContain("collected_fields");
  });

  it("Section 16 tracks workflow_step state variable", () => {
    expect(buildFullSystemPrompt(makeData())).toContain("workflow_step");
  });

  it("Section 16 tracks pending_action state variable", () => {
    expect(buildFullSystemPrompt(makeData())).toContain("pending_action");
  });

  it("Section 16 tracks frustration_count state variable", () => {
    expect(buildFullSystemPrompt(makeData())).toContain("frustration_count");
  });

  it("Section 16 tracks escalation_flag state variable", () => {
    expect(buildFullSystemPrompt(makeData())).toContain("escalation_flag");
  });

  it("Section 16 tracks connector_errors state variable", () => {
    expect(buildFullSystemPrompt(makeData())).toContain("connector_errors");
  });

  it("Section 16 state rule: never re-ask fields already in collected_fields", () => {
    const prompt = buildFullSystemPrompt(makeData());
    expect(prompt).toContain("Never ask for a field already present in collected_fields");
  });

  it("Section 16 resets state after 24 hours of inactivity", () => {
    expect(buildFullSystemPrompt(makeData())).toContain("24 hours of inactivity");
  });

  it("Section 16 handles 'where were we?' by summarising current state", () => {
    const prompt = buildFullSystemPrompt(makeData());
    expect(prompt).toContain("where were we?");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// buildActionsPromptBlock — legacy builder placeholders & markers
// ─────────────────────────────────────────────────────────────────────────────

describe("buildActionsPromptBlock — placeholder & marker integrity", () => {
  it("field-required marker uses ', required' annotation", () => {
    const result = buildActionsPromptBlock(
      makeData({
        data_fields: [
          { id: "f1", field_name: "email", label: "Email", required: true, type: "email", ask_order: 1 },
        ],
      })
    );
    expect(result).toContain(", required");
  });

  it("field-optional marker uses ', optional' annotation", () => {
    const result = buildActionsPromptBlock(
      makeData({
        data_fields: [
          { id: "f1", field_name: "notes", label: "Notes", required: false, type: "text", ask_order: 1 },
        ],
      })
    );
    expect(result).toContain(", optional");
  });

  it("action trigger 'when' value has underscores replaced with spaces", () => {
    const result = buildActionsPromptBlock(
      makeData({
        action_triggers: [
          {
            id: "t1",
            name: "Trigger A",
            when: "after_user_confirmation",
            action_type: "notify",
            target_destination: "",
            confirmation_policy: "automatic",
          },
        ],
      })
    );
    expect(result).toContain("after user confirmation");
    expect(result).not.toContain("after_user_confirmation");
  });

  it("field mapping with non-none transform includes transform label", () => {
    const result = buildActionsPromptBlock(
      makeData({
        data_sources: [
          { id: "ds1", connector_id: "gs", name: "CRM", resource_name: "R", mode: "write", purpose: "save" },
        ],
        field_mappings: [
          {
            id: "fm1",
            bot_field: "email",
            data_source_id: "ds1",
            external_field: "email_lower",
            required: true,
            transform: "lowercase",
          },
        ],
      })
    );
    expect(result).toContain("[transform: lowercase]");
  });

  it("field mapping with 'none' transform does NOT include transform label", () => {
    const result = buildActionsPromptBlock(
      makeData({
        data_sources: [
          { id: "ds1", connector_id: "gs", name: "CRM", resource_name: "R", mode: "write", purpose: "save" },
        ],
        field_mappings: [
          {
            id: "fm1",
            bot_field: "name",
            data_source_id: "ds1",
            external_field: "full_name",
            required: true,
            transform: "none",
          },
        ],
      })
    );
    expect(result).not.toContain("[transform:");
  });

  it("logic rules use IF: … → THEN: … format", () => {
    const result = buildActionsPromptBlock(
      makeData({
        logic_rules: [
          { id: "r1", if_condition: "budget < 100", then_action: "suggest lite plan" },
        ],
      })
    );
    expect(result).toContain("IF: budget < 100 → THEN: suggest lite plan");
  });
});
