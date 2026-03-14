export interface StarterButton {
  text: string;
  action_type: string;
}

export interface BotCommand {
  command: string;
  description: string;
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
  { id: "preview", title: "Behavior Preview" },
  { id: "telegram_config", title: "Telegram Config" },
  { id: "telegram_preview", title: "Telegram Preview" },
  { id: "deploy", title: "Review & Deploy" },
] as const;

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
