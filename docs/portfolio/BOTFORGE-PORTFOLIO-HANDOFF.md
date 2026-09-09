# BotForge — Portfolio Handoff

Snapshot reviewed: 2026-09-09.

This document is an employer-facing case study for `aisarus/ai-employee-forge`. It intentionally separates the working prototype from production-readiness claims.

## One sentence

**BotForge is a no-code SaaS prototype for turning a business prompt into a configurable AI Telegram bot, with account management, a deployment wizard, Supabase-backed bot state, Telegram webhooks, conversation history, BYOK AI access and external connector experiments.**

## Why this project matters in the portfolio

Aegis demonstrates orchestration and reliability architecture. Lamdan demonstrates product correction and trust-oriented UX. BotForge demonstrates a different skill: taking an immediately understandable business workflow and connecting the frontend, database, serverless functions, messaging platform and AI provider into one product path.

The core user story is simple enough for a non-technical employer to understand:

`describe the assistant → generate/configure its behavior → provide credentials → deploy to Telegram → receive real messages → call an AI provider → send the answer back → keep conversation state`

That makes it useful evidence for AI implementation / solutions / automation roles even though the project is not a finished commercial service.

## Current architecture

The repository currently contains:

- React 18 + TypeScript + Vite frontend;
- Tailwind / shadcn-style component layer;
- Supabase Auth;
- PostgreSQL-backed product data with Row Level Security;
- Supabase Edge Functions in Deno;
- Telegram Bot API integration;
- BYOK AI-provider flow plus platform fallback paths;
- per-chat message history;
- webhook-based external connector work;
- test infrastructure with Vitest and Playwright dependencies.

The public README documents the main runtime path:

1. Telegram sends an update to `telegram-webhook`;
2. the function verifies the webhook secret;
3. updates are deduplicated;
4. incoming messages are stored;
5. recent chat history is loaded;
6. the configured AI provider is called;
7. the response is sent back through Telegram;
8. the assistant message is persisted.

That is a real end-to-end integration shape, not only a frontend mock.

## Product evolution

The project began in Lovable as a visually polished B2B SaaS concept. The original prompt explicitly prioritized a simulated frontend and even instructed the builder not to create real backend integrations.

The interesting part of the project is what happened after that prototype: the repository grew real Supabase authentication/data structures, Telegram deployment/webhook functions, bot history, connector code, audit work and tests.

This gives the project a useful narrative:

**start with a fast product mock → discover what the happy-path demo hides → progressively replace simulated behavior with real integrations and explicit technical debt.**

## Concrete integration work

### Telegram deployment

The documented deployment flow validates a bot token, creates/updates bot state, registers a Telegram webhook with a secret token and checks webhook state after deployment.

### Incoming-message runtime

The Telegram webhook handles incoming updates, stores conversation history and builds context from recent messages before producing a reply.

### BYOK provider model

The user can provide an AI API key instead of forcing every bot through one platform-owned provider account. This is a useful product/business choice because provider cost and ownership become explicit rather than invisible.

### External connectors

The repository contains connector work for webhook delivery and additional service integrations. This area evolved after the original audit and should be described connector-by-connector rather than advertised as a universal automation engine.

## Security/reliability story — the audit changed what “done” meant

A March 2026 automated audit is committed to the repository as `AUDIT.md`. It is unusually valuable as portfolio material because it openly records that the visually working product still had major gaps.

The audit identified, among other things:

- plaintext credential-storage concerns;
- incomplete/stub connector paths;
- webhook timeout and observability risks;
- missing rate limiting / lifecycle behavior;
- UI paths that existed without complete backend execution;
- mobile/accessibility gaps.

The right way to use this in a portfolio is **not** to hide the audit. It is to show that the project moved from “looks like SaaS” toward asking whether each path is real, safe and observable.

## Security/reliability story — credential storage improved, but is not production-grade yet

Later code introduced AES-256-GCM helpers and encrypt/decrypt paths for API/connector values before storage.

However, the current shared crypto implementation derives its key from a fixed passphrase shipped with the application code. The source comments correctly describe this as **obfuscation at rest**, not cryptographic confidentiality against somebody who can read the code. The code itself recommends moving to Supabase Vault for production-grade storage.

That distinction must remain explicit in interviews and portfolio copy.

**Credible statement:** the project moved away from raw plaintext storage and created migration/compatibility paths.

**Not credible:** “credentials are production-secure.”

## Security/reliability story — removing a fake authorization boundary

During the September 2026 portfolio audit, the live source still contained a hidden client-side “master” shortcut that bypassed the free-bot limit based on a hardcoded value stored/checked in browser state.

That is not an authorization mechanism: any client-side secret is recoverable by the user running the client.

The bypass was removed entirely on 2026-09-09 rather than replaced with another obfuscated browser secret. The UI limit now applies normally to everyone.

There is still an important remaining boundary: the free-bot limit is currently a client-side product guardrail, not a server-enforced entitlement. Real commercial enforcement belongs on the trusted backend/database side.

This is a useful debugging/security story because the correct solution was **delete the false security mechanism**, not make the password harder to find.

## Repository hygiene discovered during the portfolio pass

The public repository also had a tracked `.env` containing frontend Supabase project configuration and a publishable/anonymous browser key.

Those values are intended for browser use and were not equivalent to a service-role secret, but committing a local `.env` is still poor repository hygiene. The file was removed from tracking and `.env` patterns were added to `.gitignore`, with `.env.example` retained as documentation.

This is deliberately included here because the purpose of the portfolio pass is not to make history look perfect; it is to make the current artifact defensible.

## What the author actually did

BotForge is an AI-native/Lovable-origin project. It should not be presented as thousands of lines manually authored from scratch.

The accurate role is:

**Product owner / AI-native builder who took a simulated SaaS concept into a real multi-service prototype, repeatedly used AI implementation tools, audited their output, identified where the generated product was only pretending to be complete, and pushed the system toward real integrations and clearer security boundaries.**

That includes:

- defining the business-facing product concept;
- iterating the wizard and user workflow through Lovable;
- moving from mocked product states into Supabase/Telegram integration work;
- directing AI agents across frontend, serverless and database changes;
- reviewing generated architecture and audit findings;
- distinguishing UI validation from actual backend enforcement;
- introducing or directing credential-handling improvements;
- finding and removing the client-side master bypass during portfolio cleanup;
- refusing to describe bundle-key obfuscation as production encryption;
- maintaining a live/published product surface while the implementation evolved.

## Skills this project can credibly support

BotForge is evidence for:

- AI-assisted SaaS prototyping;
- business-process translation into product workflows;
- Telegram Bot API integration;
- webhook architecture;
- Supabase Auth / database / RLS concepts;
- serverless Edge Functions;
- BYOK AI-provider integration;
- chat-history/context workflows;
- connector / automation architecture;
- security review of AI-generated code;
- distinguishing prototypes from production guarantees;
- iterative Lovable + repository development.

It should not be used to claim production security engineering, large-scale SaaS operations or mature billing/entitlement infrastructure.

## Known limits that must remain visible

BotForge should currently be described as a **working SaaS prototype**, not production-ready software.

Known/important limits include:

- credential encryption still relies on an application-known fixed passphrase and therefore remains obfuscation rather than strong server-side secret management;
- commercial/free-tier entitlement is not yet enforced as a trusted server-side policy;
- older audit findings must be rechecked individually before claiming every connector is complete;
- the repository has evolved through Lovable and contains historical generated structure/debt;
- tests/builds establish implementation confidence, not production security or scalability;
- there is no basis here for claiming large-scale customer usage.

## Employer inspection path

Recommended order:

1. [`README.md`](../../README.md) — product and runtime architecture;
2. [`AUDIT.md`](../../AUDIT.md) — historical gap analysis;
3. `supabase/functions/telegram-webhook/` — inbound Telegram runtime;
4. `supabase/functions/deploy-telegram/` — deployment flow;
5. `supabase/functions/_shared/crypto.ts` — current credential-obfuscation boundary and its explicit caveat;
6. `src/components/DeployWizard.tsx` — configuration/deployment UI;
7. `src/pages/MyAgents.tsx` — bot lifecycle UI;
8. `src/hooks/useConnectors.ts` and connector edge functions — automation layer.

Live project metadata currently points to the deployed project surface as well; availability should be verified immediately before using the link in an application.

## Portfolio-ready narrative

### Hero

> **From a fake SaaS demo to a real Telegram automation prototype.**
>
> BotForge started as a Lovable-generated interface. I pushed it into a multi-service product path with authentication, persisted bot configuration, Telegram webhooks, AI-provider calls and connector work — then audited where generated code was still faking security or completeness.

### Three proof points

1. **Demo → integration.** The original prototype explicitly used simulated state; later iterations connected Supabase, Telegram and provider runtimes.
2. **Business-readable workflow.** A non-technical user can configure and deploy an AI bot without building the webhook/runtime themselves.
3. **Audit the generator.** Security and completeness problems produced by rapid AI development are treated as engineering work, not hidden behind the UI.

## CV-ready entry

**BotForge — AI Telegram Automation SaaS Prototype · Product Owner / AI-native Builder**

Expanded a Lovable-built SaaS concept into a working multi-service prototype for configuring and deploying AI Telegram bots. Directed AI-assisted implementation across React/TypeScript UI, Supabase Auth/PostgreSQL/RLS, Deno Edge Functions, Telegram webhooks, conversation history, BYOK model access and connector workflows. Used repository audits and targeted remediation to separate simulated features from real integrations, remove a client-side authorization bypass and document remaining production security boundaries rather than overstating readiness.

## Screenshots / media to capture for the portfolio

The useful visuals are not generic dashboard screenshots. Capture a short end-to-end story:

1. business description / bot creation screen;
2. generated/configured bot brain;
3. Telegram configuration and deploy step;
4. the resulting Telegram bot responding to a real message;
5. My Agents lifecycle screen;
6. one connector/configuration flow;
7. optionally, a small architecture animation showing Browser → Supabase → Telegram → AI provider.

A 20–30 second screen recording of “configure → deploy → message the bot → receive response” would carry more evidence than a long screenshot gallery.

## Short conclusion

BotForge is useful precisely because it is not the same kind of project as Aegis or Lamdan.

Its strongest story is:

**I can take an understandable business automation idea, prototype it extremely quickly with AI tools, wire the prototype into real external services, and then audit the generated implementation hard enough to tell the difference between a convincing demo and an actually defensible system.**