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

export interface WizardData {
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

  // Telegram Config
  telegram_bot_token: string;
  telegram_display_name: string;
  telegram_short_description: string;
  telegram_about_text: string;
  telegram_commands: BotCommand[];
  webhook_mode: string;
  custom_webhook_url: string;
}

export const WIZARD_STEPS = [
  { id: "identity", title: "Bot Identity" },
  { id: "welcome", title: "Welcome Experience" },
  { id: "actions", title: "Actions & Data" },
  { id: "workflow", title: "Logic & Workflow" },
  { id: "preview", title: "Behavior Preview" },
  { id: "telegram_config", title: "Telegram Config" },
  { id: "telegram_preview", title: "Telegram Preview" },
  { id: "deploy", title: "Review & Deploy" },
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

export const LANGUAGES = ["English", "Russian", "Hebrew", "Arabic", "Spanish", "French", "German", "Other"];
export const TONES = ["Friendly", "Professional", "Formal", "Supportive", "Playful", "Concise"];
export const RESPONSE_STYLES = ["Concise", "Detailed", "Step-by-step", "Bullet points", "Conversational"];
