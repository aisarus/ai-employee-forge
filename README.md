# BotForge

**BotForge** is a no-code SaaS platform for building, configuring, and deploying AI-powered Telegram bots. Connect your OpenAI API key (BYOK), write a system prompt, and have a live bot in minutes — no backend coding required.

---

## What is BotForge?

BotForge turns a Telegram bot token and an OpenAI API key into a fully functional AI assistant. Every bot:

- Replies to messages using GPT-4o-mini (your key) with automatic fallback to the platform's AI gateway.
- Maintains per-chat conversation history (last 30 turns).
- Sends a configurable welcome message and quick-action buttons on `/start`.
- Can forward events to your own webhook endpoint via the **Webhook Connector**.

---

## Create Your First Bot (5 Steps)

### Step 1 — Sign up and open the wizard

Create an account and click **Create new bot** to launch the step-by-step wizard.

### Step 2 — Name your bot and write a system prompt

Give your bot a display name and write the system prompt that defines its personality and capabilities (e.g. *"You are a helpful customer support agent for Acme Corp."*).

### Step 3 — Paste your OpenAI API key

Go to [platform.openai.com/api-keys](https://platform.openai.com/api-keys), create a key, and paste it in the **API Keys** step. The key is encrypted with AES-256-GCM before being stored.

### Step 4 — Connect your Telegram bot token

1. Open [@BotFather](https://t.me/BotFather) in Telegram.
2. Send `/newbot` and follow the prompts.
3. Copy the token BotFather gives you and paste it into the **Telegram Config** step.

### Step 5 — Deploy

Click **Deploy**. BotForge registers a webhook with Telegram automatically. Your bot is now live — open it in Telegram and say hello.

---

## Webhook API

When you add a **Webhook Connector** to a bot, BotForge calls your endpoint for every user interaction.

### Delivery

```
POST <your-webhookUrl>
Content-Type: application/json
```

### Payload shape

```jsonc
{
  "agentId": "uuid-of-the-agent",
  "event": "message",           // "message" | "callback_query" | "start"
  "chatId": 123456789,          // Telegram chat ID (number)
  "userId": 987654321,          // Telegram user ID (number)
  "username": "alice",          // Telegram username, may be null
  "text": "Hello bot!",         // Message text or callback data
  "timestamp": "2026-03-16T12:00:00.000Z"
}
```

### Retry policy

The **webhook-connector** Edge Function makes up to **3 delivery attempts** with exponential back-off:

| Attempt | Delay before attempt |
|---------|----------------------|
| 1       | immediately          |
| 2       | 1 second             |
| 3       | 2 seconds            |

A `2xx` response from your endpoint is considered success. Any other status or a network error triggers the next retry. After all attempts fail, the connector status is set to `error` and logged in the `bot_connectors` table.

### Trigger manually via the Edge Function

```bash
curl -X POST https://<project>.supabase.co/functions/v1/webhook-connector \
  -H "Authorization: Bearer <anon-key>" \
  -H "Content-Type: application/json" \
  -d '{
    "agentId": "your-agent-uuid",
    "webhookUrl": "https://your-server.example.com/hook",
    "payload": { "hello": "world" }
  }'
```

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18, TypeScript, Vite, Tailwind CSS, shadcn/ui |
| State / data | TanStack Query, React Hook Form, Zod |
| Backend / DB | Supabase (Postgres + Auth + Storage + RLS) |
| Edge Functions | Deno (Supabase Edge Runtime) |
| AI | OpenAI GPT-4o-mini (BYOK) · Lovable AI gateway (fallback) |
| Telegram | Bot API webhooks via `deploy-telegram` Edge Function |
| Client crypto | Web Crypto API — AES-256-GCM via PBKDF2-derived key |
| Testing | Vitest (unit) · Playwright (E2E) |

---

## Local Development

```bash
# Install dependencies
bun install

# Start the dev server
bun run dev

# Run unit tests
bun run test

# Run E2E tests (requires Playwright browsers)
bunx playwright test
```

Copy `.env.example` to `.env` and fill in your Supabase project URL and anon key before starting.

---

## License

MIT © BotForge contributors
