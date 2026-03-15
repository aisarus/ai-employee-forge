

## Анализ проблем

Текущее состояние:

1. **BYOK в DeployWizard** — работает: визард собирает `openai_api_key` в `StepApiKeys`, передаёт в `deploy-telegram`, edge function сохраняет в БД, `telegram-poll` использует при ответах.

2. **BYOK в DeployModal** — убран: модалка не имеет поля для OpenAI ключа и не передаёт `openaiApiKey` в `deploy-telegram`. Если бот создан через эту модалку, в БД `openai_api_key = NULL`.

3. **Боты не отвечают** — в `telegram-poll` логика: если нет `openai_api_key` у агента → `useLovableAi = true` → используется `LOVABLE_API_KEY`. Ключ `LOVABLE_API_KEY` есть в секретах, значит проблема скорее всего в самом вызове Lovable AI Gateway (ошибка тихо ловится catch, reply остаётся "Sorry, I couldn't process that.").

4. **TRI-TFM** — `llm.ts` уже вызывает `llm-proxy` edge function → Lovable AI Gateway. Если `llm-proxy` работает, инструкции должны улучшаться. Нужно убедиться что `llm-proxy` деплоится и функционирует.

## План

### 1. Вернуть опциональное BYOK поле в DeployModal

- Добавить `openaiKey` state в `DeployModal.tsx`
- Добавить опциональное поле ввода OpenAI API Key (collapsible, под заголовком "Advanced / Продвинутые настройки")
- Передавать `openaiApiKey: openaiKey` в body запроса к `deploy-telegram`
- Поле необязательное — без ключа бот будет использовать встроенный AI

### 2. Исправить проблему "Sorry, I couldn't process that."

- В `telegram-poll` добавить логирование ответа AI Gateway (статус, тело) чтобы видеть ошибки
- Проверить что при использовании Lovable AI отправляется корректный запрос (правильный формат, не пустые messages)
- Добавить проверку `aiRes.ok` перед парсингом JSON — если ошибка, логировать детально

### 3. Убедиться что test-bot и Workspace тоже поддерживают fallback на Lovable AI

- `test-bot/index.ts` сейчас требует `openaiKey` обязательно — добавить fallback на Lovable AI Gateway когда ключ не передан
- `Workspace.tsx` берёт ключ из localStorage — добавить fallback через `llm-proxy` если ключа нет

### Файлы для изменения

- `src/components/DeployModal.tsx` — добавить опциональное BYOK поле
- `supabase/functions/telegram-poll/index.ts` — улучшить логирование ошибок AI
- `supabase/functions/test-bot/index.ts` — добавить fallback на Lovable AI
- `src/components/Workspace.tsx` — fallback на `llm-proxy` без ключа

