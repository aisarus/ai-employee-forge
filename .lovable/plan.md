

## Диагноз

Логи `telegram-poll` показывают конкретную ошибку:

```
OpenAI error for agent bd12eac4... status: 429
"message": "You exceeded your current quota"
```

Агенты с BYOK ключами, у которых исчерпана квота OpenAI, получают 429 и отдают fallback-сообщение "Sorry, I couldn't process that." **Код не делает fallback на Lovable AI Gateway при ошибке BYOK.**

## План

### 1. Добавить fallback в `telegram-poll` при ошибке BYOK

В `supabase/functions/telegram-poll/index.ts` -- если OpenAI возвращает 402/403/429 (квота/ключ), автоматически retry через Lovable AI Gateway вместо того чтобы оставлять дефолтный reply.

### 2. Добавить fallback в `test-bot` при ошибке BYOK

В `supabase/functions/test-bot/index.ts` -- аналогичная логика: если OpenAI BYOK вернул ошибку квоты/авторизации, сделать fallback на Lovable AI.

### 3. Улучшить сообщение об ошибке

Вместо generic "Sorry, I couldn't process that." -- если все провайдеры отказали, дать более информативное сообщение.

### Файлы для изменения
- `supabase/functions/telegram-poll/index.ts`
- `supabase/functions/test-bot/index.ts`

