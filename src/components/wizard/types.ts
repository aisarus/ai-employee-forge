export interface StarterButton {
  text: string;
  action_type: string;
}

export interface BotCommand {
  command: string;
  description: string;
}

export interface DataField {
  id: string;
  field_name: string;
  label: string;
  required: boolean;
  type: "text" | "phone" | "date" | "number" | "select";
  ask_order: number;
  options?: string[];
}

export interface WorkflowStep {
  id: string;
  title: string;
  action_type: string;
  next_step?: string;
}

export interface LogicRule {
  id: string;
  if_condition: string;
  then_action: string;
}

// --- Integration types ---

export interface ConnectorConfig {
  id: string;
  type: string;
  display_name: string;
  status: "connected" | "disconnected" | "error" | "pending";
  auth_value: string;
  capabilities: ("read" | "write")[];
  /** Type-specific config fields (e.g. spreadsheet_id, sheet_name for Google Sheets) */
  config?: Record<string, string>;
}

export interface DataSource {
  id: string;
  connector_id: string;
  name: string;
  resource_name: string;
  mode: "read" | "write";
  purpose: string;
}

export interface FieldMapping {
  id: string;
  bot_field: string;
  data_source_id: string;
  external_field: string;
  required: boolean;
  transform: "none" | "lowercase" | "uppercase" | "date_format" | "phone_normalize";
}

export interface ActionTrigger {
  id: string;
  name: string;
  when: string;
  action_type: string;
  target_destination: string;
  confirmation_policy: "ask_before_send" | "automatic" | "draft_only";
}

export interface IntegrationRule {
  id: string;
  if_condition: string;
  then_action: string;
}

export interface WizardData {
  // BYOK
  openai_api_key: string;

  // Identity
  bot_name: string;
  bot_username_hint: string;
  bot_avatar_url: string;
  bot_avatar_file: File | null;
  short_description: string;
  about_text: string;
  default_language: string;
  tone: string;
  response_style: string;

  // Welcome
  welcome_message: string;
  starter_buttons: StarterButton[];
  fallback_message: string;

  // Bot Actions
  bot_type: string;
  bot_actions: string[];
  data_fields: DataField[];
  workflow_steps: WorkflowStep[];
  logic_rules: LogicRule[];
  external_actions: string[];

  // Integrations
  connectors: ConnectorConfig[];
  data_sources: DataSource[];
  field_mappings: FieldMapping[];
  action_triggers: ActionTrigger[];
  integration_rules: IntegrationRule[];

  // Telegram Config
  telegram_bot_token: string;
  telegram_display_name: string;
  telegram_short_description: string;
  telegram_about_text: string;
  telegram_commands: BotCommand[];
  webhook_mode: string;
  custom_webhook_url: string;
}

// ── Static full step list (kept for backward compat) ──────────────────────────
export const WIZARD_STEPS = [
  { id: "identity", title: "Bot Identity" },
  { id: "welcome", title: "Welcome Experience" },
  { id: "actions", title: "Actions & Data" },
  { id: "workflow", title: "Logic & Workflow" },
  { id: "connections", title: "Connections" },
  { id: "data_mapping", title: "Data & Mapping" },
  { id: "triggers", title: "Triggers" },
  { id: "preview", title: "Behavior Preview" },
  { id: "telegram_config", title: "Telegram Config" },
  { id: "telegram_preview", title: "Telegram Preview" },
  { id: "deploy", title: "Review & Deploy" },
] as const;

// ── Dynamic step profiles per bot type ────────────────────────────────────────
// Steps: bot_type → identity → welcome → (type-specific) → api_keys → telegram_config → telegram_preview → deploy

export const BOT_TYPE_STEP_PROFILES: Record<string, readonly string[]> = {
  // Simple bots — minimal steps
  support:  ["bot_type", "identity", "welcome", "api_keys", "telegram_config", "telegram_preview", "deploy"],
  faq:      ["bot_type", "identity", "welcome", "api_keys", "telegram_config", "telegram_preview", "deploy"],
  // Medium bots
  lead:     ["bot_type", "identity", "welcome", "actions", "api_keys", "telegram_config", "telegram_preview", "deploy"],
  booking:  ["bot_type", "identity", "welcome", "actions", "connections", "api_keys", "telegram_config", "telegram_preview", "deploy"],
  order:    ["bot_type", "identity", "welcome", "actions", "connections", "api_keys", "telegram_config", "telegram_preview", "deploy"],
  // Full bots
  sales:    ["bot_type", "identity", "welcome", "actions", "workflow", "connections", "api_keys", "telegram_config", "telegram_preview", "deploy"],
  custom:   ["bot_type", "identity", "welcome", "actions", "workflow", "connections", "data_mapping", "triggers", "preview", "api_keys", "telegram_config", "telegram_preview", "deploy"],
  // Before type selected
  "":       ["bot_type"],
};

export function getWizardSteps(botType: string): readonly string[] {
  return BOT_TYPE_STEP_PROFILES[botType] ?? BOT_TYPE_STEP_PROFILES["custom"];
}

export const AVAILABLE_CONNECTORS = [
  { id: "google_sheets", name: "Google Sheets", icon: "📊", category: "Spreadsheet", auth_hint: "API Key", caps: ["read", "write"] as const },
  { id: "airtable", name: "Airtable", icon: "🗄️", category: "Database", auth_hint: "API Key", caps: ["read", "write"] as const },
  { id: "google_calendar", name: "Google Calendar", icon: "📅", category: "Calendar", auth_hint: "API Key", caps: ["read", "write"] as const },
  { id: "telegram_admin", name: "Telegram Admin", icon: "📢", category: "Messaging", auth_hint: "Chat ID", caps: ["write"] as const },
  { id: "email", name: "Email (SMTP)", icon: "📧", category: "Notifications", auth_hint: "SMTP / API Key", caps: ["write"] as const },
  { id: "webhook", name: "Custom Webhook", icon: "🔗", category: "Automation", auth_hint: "URL", caps: ["read", "write"] as const },
  { id: "shopify", name: "Shopify", icon: "🛍️", category: "Store", auth_hint: "API Key", caps: ["read", "write"] as const },
  { id: "woocommerce", name: "WooCommerce", icon: "🛒", category: "Store", auth_hint: "API Key", caps: ["read", "write"] as const },
  { id: "custom_api", name: "Custom REST API", icon: "⚡", category: "Advanced", auth_hint: "Base URL + Key", caps: ["read", "write"] as const },
] as const;

export const TRIGGER_WHEN_OPTIONS = [
  "after_required_fields_collected",
  "after_user_confirmation",
  "on_urgent_issue",
  "on_new_lead",
  "on_booking_confirmed",
  "on_manual_review",
  "on_every_message",
  "custom_condition",
] as const;

export const TRIGGER_ACTIONS = [
  "Check availability",
  "Create order",
  "Update order",
  "Create booking",
  "Reschedule booking",
  "Cancel booking",
  "Create support ticket",
  "Create lead",
  "Save to Google Sheets",
  "Send email notification",
  "Send Telegram notification",
  "Call webhook",
  "Call custom API",
] as const;

export const TRANSFORM_OPTIONS = [
  "none",
  "lowercase",
  "uppercase",
  "date_format",
  "phone_normalize",
] as const;

export const BOT_TYPES = [
  { id: "sales", label: "Sales Bot", icon: "💰", desc: "Sell products & services" },
  { id: "booking", label: "Booking Bot", icon: "📅", desc: "Manage appointments" },
  { id: "support", label: "Support Bot", icon: "🛟", desc: "Handle customer issues" },
  { id: "lead", label: "Lead Qualification", icon: "🎯", desc: "Qualify & capture leads" },
  { id: "faq", label: "FAQ Bot", icon: "❓", desc: "Answer common questions" },
  { id: "order", label: "Order Bot", icon: "📦", desc: "Process orders" },
  { id: "custom", label: "Custom Bot", icon: "⚙️", desc: "Build from scratch" },
];

export const BOT_ACTIONS = [
  "Answer questions",
  "Recommend products",
  "Collect customer details",
  "Create booking",
  "Reschedule booking",
  "Cancel booking",
  "Collect lead information",
  "Create support ticket",
  "Escalate to human",
  "Offer alternatives",
  "Ask clarifying questions",
  "Send confirmation message",
  "Notify manager",
  "Save order",
  "Save lead",
  "Send webhook",
];

export const EXTERNAL_ACTIONS = [
  "Send order to Telegram admin",
  "Send lead to email",
  "Save data to Google Sheets",
  "Create webhook request",
  "Create CRM lead",
  "Notify support team",
];

export const WORKFLOW_ACTION_TYPES = [
  { value: "ask_question", label: "Ask Question" },
  { value: "recommend", label: "Recommend" },
  { value: "collect_field", label: "Collect Field" },
  { value: "condition", label: "Condition / Branch" },
  { value: "confirm", label: "Confirm" },
  { value: "escalate", label: "Escalate" },
  { value: "notify", label: "Notify" },
  { value: "custom", label: "Custom Action" },
];

export const DEFAULT_WIZARD_DATA: WizardData = {
  openai_api_key: "",
  bot_name: "",
  bot_username_hint: "",
  bot_avatar_url: "",
  bot_avatar_file: null,
  short_description: "",
  about_text: "",
  default_language: "English",
  tone: "Friendly",
  response_style: "Concise",
  welcome_message: "",
  starter_buttons: [],
  fallback_message: "",
  bot_type: "",
  bot_actions: [],
  data_fields: [],
  workflow_steps: [],
  logic_rules: [],
  external_actions: [],
  connectors: [],
  data_sources: [],
  field_mappings: [],
  action_triggers: [],
  integration_rules: [],
  telegram_bot_token: "",
  telegram_display_name: "",
  telegram_short_description: "",
  telegram_about_text: "",
  telegram_commands: [
    { command: "/start", description: "Start interacting with the bot" },
    { command: "/help", description: "See what the bot can do" },
  ],
  webhook_mode: "Auto-generate webhook URL",
  custom_webhook_url: "",
};

// ── Bot type presets (i18n keys resolved at apply time) ───────────────────────
export interface BotTypePreset {
  welcome_message_key: string;
  fallback_message_key: string;
  bot_actions: string[];
  starter_buttons: StarterButton[];
  data_fields: DataField[];
  telegram_commands: BotCommand[];
}

export const BOT_TYPE_PRESETS: Record<string, BotTypePreset> = {
  support: {
    welcome_message_key:  "preset.support.welcome",
    fallback_message_key: "preset.support.fallback",
    bot_actions:          ["Answer questions", "Create support ticket", "Escalate to human"],
    starter_buttons:      [{ text: "I have a problem", action_type: "text" }, { text: "Track my request", action_type: "text" }],
    data_fields:          [],
    telegram_commands:    [{ command: "/start", description: "Start" }, { command: "/help", description: "Help" }, { command: "/ticket", description: "Open ticket" }],
  },
  faq: {
    welcome_message_key:  "preset.faq.welcome",
    fallback_message_key: "preset.faq.fallback",
    bot_actions:          ["Answer questions", "Ask clarifying questions"],
    starter_buttons:      [{ text: "Ask a question", action_type: "text" }],
    data_fields:          [],
    telegram_commands:    [{ command: "/start", description: "Start" }, { command: "/help", description: "Help" }],
  },
  sales: {
    welcome_message_key:  "preset.sales.welcome",
    fallback_message_key: "preset.sales.fallback",
    bot_actions:          ["Answer questions", "Recommend products", "Collect customer details", "Send confirmation message"],
    starter_buttons:      [{ text: "View catalog", action_type: "text" }, { text: "Place order", action_type: "text" }, { text: "Ask a question", action_type: "text" }],
    data_fields:          [],
    telegram_commands:    [{ command: "/start", description: "Start" }, { command: "/help", description: "Help" }, { command: "/catalog", description: "View catalog" }, { command: "/order", description: "Place order" }],
  },
  booking: {
    welcome_message_key:  "preset.booking.welcome",
    fallback_message_key: "preset.booking.fallback",
    bot_actions:          ["Create booking", "Reschedule booking", "Cancel booking", "Collect customer details"],
    starter_buttons:      [{ text: "Book now", action_type: "text" }, { text: "My bookings", action_type: "text" }],
    data_fields: [
      { id: "f1", field_name: "name",  label: "Full name",    required: true,  type: "text",  ask_order: 1 },
      { id: "f2", field_name: "phone", label: "Phone number", required: true,  type: "phone", ask_order: 2 },
      { id: "f3", field_name: "date",  label: "Preferred date", required: true, type: "date", ask_order: 3 },
    ],
    telegram_commands:    [{ command: "/start", description: "Start" }, { command: "/book", description: "Book appointment" }, { command: "/cancel", description: "Cancel booking" }],
  },
  lead: {
    welcome_message_key:  "preset.lead.welcome",
    fallback_message_key: "preset.lead.fallback",
    bot_actions:          ["Collect lead information", "Ask clarifying questions", "Send confirmation message"],
    starter_buttons:      [{ text: "Get a quote", action_type: "text" }, { text: "Learn more", action_type: "text" }],
    data_fields: [
      { id: "f1", field_name: "name",    label: "Full name",    required: true,  type: "text",  ask_order: 1 },
      { id: "f2", field_name: "phone",   label: "Phone number", required: true,  type: "phone", ask_order: 2 },
      { id: "f3", field_name: "company", label: "Company",      required: false, type: "text",  ask_order: 3 },
    ],
    telegram_commands:    [{ command: "/start", description: "Start" }, { command: "/help", description: "Help" }],
  },
  order: {
    welcome_message_key:  "preset.order.welcome",
    fallback_message_key: "preset.order.fallback",
    bot_actions:          ["Save order", "Collect customer details", "Send confirmation message", "Notify manager"],
    starter_buttons:      [{ text: "Place order", action_type: "text" }, { text: "Track order", action_type: "text" }],
    data_fields: [
      { id: "f1", field_name: "name",    label: "Full name",       required: true,  type: "text",  ask_order: 1 },
      { id: "f2", field_name: "phone",   label: "Phone number",    required: true,  type: "phone", ask_order: 2 },
      { id: "f3", field_name: "address", label: "Delivery address", required: true, type: "text",  ask_order: 3 },
    ],
    telegram_commands:    [{ command: "/start", description: "Start" }, { command: "/order", description: "Place order" }, { command: "/status", description: "Order status" }],
  },
  custom: {
    welcome_message_key:  "preset.custom.welcome",
    fallback_message_key: "preset.custom.fallback",
    bot_actions:          [],
    starter_buttons:      [],
    data_fields:          [],
    telegram_commands:    [{ command: "/start", description: "Start" }, { command: "/help", description: "Help" }],
  },
};

export const LANGUAGES = ["English", "Russian", "Hebrew", "Arabic", "Spanish", "French", "German", "Other"];
export const TONES = ["Friendly", "Professional", "Formal", "Supportive", "Playful", "Concise"];
export const RESPONSE_STYLES = ["Concise", "Detailed", "Step-by-step", "Bullet points", "Conversational"];
