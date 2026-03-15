import { createContext, useContext, useState, useEffect, ReactNode } from "react";

export type Lang = "ru" | "en";

const translations = {
  // Navigation & Header
  "nav.dashboard": { en: "Dashboard", ru: "Панель" },
  "nav.create_agent": { en: "Create New Agent", ru: "Создать агента" },
  "nav.my_agents": { en: "My Agents", ru: "Мои агенты" },
  "nav.integrations": { en: "Integrations", ru: "Интеграции" },
  "nav.billing": { en: "Billing", ru: "Оплата" },
  "nav.settings": { en: "Settings", ru: "Настройки" },
  "nav.logout": { en: "Log out", ru: "Выйти" },

  // Auth
  "auth.welcome": { en: "Welcome to BotForge", ru: "Добро пожаловать в BotForge" },
  "auth.create_account": { en: "Create Account", ru: "Создать аккаунт" },
  "auth.sign_in_desc": { en: "Sign in to manage your AI bots", ru: "Войдите, чтобы управлять ботами" },
  "auth.sign_up_desc": { en: "Get started building AI bots", ru: "Начните создавать AI-ботов" },
  "auth.email": { en: "Email", ru: "Email" },
  "auth.password": { en: "Password", ru: "Пароль" },
  "auth.sign_in": { en: "Sign In", ru: "Войти" },
  "auth.sign_up_link": { en: "Don't have an account? Sign up", ru: "Нет аккаунта? Зарегистрируйтесь" },
  "auth.sign_in_link": { en: "Already have an account? Sign in", ru: "Уже есть аккаунт? Войти" },
  "auth.welcome_back": { en: "Welcome back!", ru: "С возвращением!" },
  "auth.check_email": { en: "Check your email to confirm your account!", ru: "Проверьте почту для подтверждения аккаунта!" },

  // Index / Create
  "create.title": { en: "Build your AI Bot", ru: "Создайте AI-бота" },
  "create.subtitle": { en: "Describe your business in plain text, we do the prompt engineering.", ru: "Опишите ваш бизнес простым текстом — мы сделаем промпт-инжиниринг." },
  "create.api_key_placeholder": { en: "Paste your OpenAI API Key (sk-...)", ru: "Вставьте ваш OpenAI API ключ (sk-...)" },
  "create.bot_name": { en: "Bot Name", ru: "Имя бота" },
  "create.bot_name_placeholder": { en: "e.g., Flora Assistant", ru: "напр., Флора Ассистент" },
  "create.description": { en: "Description", ru: "Описание" },
  "create.description_placeholder": { en: "e.g., Flower shop sales bot", ru: "напр., Бот для продажи цветов" },
  "create.tone": { en: "Tone", ru: "Тон" },
  "create.response_style": { en: "Response Style", ru: "Стиль ответа" },
  "create.instructions_placeholder": { en: "e.g., I sell flowers. Delivery is $5. If roses are out of stock, offer tulips. Ask for address and phone number.", ru: "напр., Я продаю цветы. Доставка 500₽. Если роз нет, предложите тюльпаны. Спросите адрес и номер телефона." },
  "create.generate": { en: "Generate AI Brain", ru: "Сгенерировать AI-мозг" },
  "create.tone.professional": { en: "Professional", ru: "Профессиональный" },
  "create.tone.friendly": { en: "Friendly", ru: "Дружелюбный" },
  "create.tone.formal": { en: "Formal", ru: "Формальный" },
  "create.tone.casual": { en: "Casual", ru: "Повседневный" },
  "create.tone.humorous": { en: "Humorous", ru: "С юмором" },
  "create.style.concise": { en: "Concise", ru: "Кратко" },
  "create.style.detailed": { en: "Detailed", ru: "Подробно" },
  "create.style.step_by_step": { en: "Step-by-step", ru: "Пошагово" },
  "create.style.conversational": { en: "Conversational", ru: "Разговорный" },

  // Workspace
  "workspace.agent_persona": { en: "Agent Persona (Optimized)", ru: "Персона агента (оптимизирована)" },
  "workspace.live_sandbox": { en: "Live Sandbox", ru: "Песочница" },
  "workspace.test_placeholder": { en: "Test your bot... (Press Enter)", ru: "Протестируйте бота... (Enter)" },
  "workspace.deploy_bot": { en: "Deploy Bot", ru: "Развернуть бота" },
  "workspace.chat_intro": { en: "Hi! I'm your new AI employee, working by the instruction on the left. Send me a message!", ru: "Привет! Я ваш новый AI-сотрудник, работаю по инструкции слева. Напишите мне!" },
  "workspace.no_key": { en: "⚠️ Enter your OpenAI key on the main page to enable chat!", ru: "⚠️ Введите ваш OpenAI ключ на главной для чата!" },
  "workspace.network_error": { en: "❌ Network error.", ru: "❌ Ошибка сети." },
  "workspace.rgi": { en: "Reasoning Gain (RGI)", ru: "Рост рассуждений (RGI)" },
  "workspace.qg": { en: "Quality Gain (QG)", ru: "Рост качества (QG)" },
  "workspace.issues_fixed": { en: "Issues Fixed", ru: "Исправлено" },
  "workspace.structure_enhanced": { en: "Structure enhanced", ru: "Структура улучшена" },

  // My Agents
  "agents.title": { en: "My Agents", ru: "Мои агенты" },
  "agents.subtitle": { en: "Manage and monitor your deployed AI agents.", ru: "Управляйте развёрнутыми AI-агентами." },
  "agents.create_new": { en: "Create New Agent", ru: "Создать агента" },
  "agents.search": { en: "Search agents...", ru: "Поиск агентов..." },
  "agents.no_agents": { en: "No agents yet", ru: "Агентов пока нет" },
  "agents.no_agents_desc": { en: "Create your first AI agent to get started.", ru: "Создайте первого AI-агента." },
  "agents.create": { en: "Create Agent", ru: "Создать агента" },
  "agents.edit": { en: "Edit", ru: "Редактировать" },
  "agents.test": { en: "Test", ru: "Тестировать" },
  "agents.pause": { en: "Pause", ru: "Приостановить" },
  "agents.activate": { en: "Activate", ru: "Активировать" },
  "agents.delete": { en: "Delete", ru: "Удалить" },
  "agents.deleted": { en: "Agent deleted", ru: "Агент удалён" },

  // Integrations
  "integrations.title": { en: "Integrations", ru: "Интеграции" },
  "integrations.subtitle": { en: "Connect your agents to messaging platforms.", ru: "Подключите агентов к мессенджерам." },
  "integrations.connected": { en: "Connected", ru: "Подключено" },
  "integrations.disconnected": { en: "Disconnected", ru: "Отключено" },
  "integrations.configure": { en: "Configure", ru: "Настроить" },
  "integrations.setup": { en: "Setup", ru: "Подключить" },
  "integrations.telegram_desc": { en: "Deploy bots via BotFather", ru: "Развёртывание через BotFather" },
  "integrations.whatsapp_desc": { en: "Connect via WhatsApp Business API", ru: "Подключение через WhatsApp Business API" },
  "integrations.instagram_desc": { en: "Auto-reply to Instagram messages", ru: "Авто-ответы в Instagram" },
  "integrations.web_desc": { en: "Embed a chat widget on your site", ru: "Встройте чат-виджет на сайт" },
  "integrations.webhook_desc": { en: "Connect to any platform via webhooks", ru: "Подключение через вебхуки" },

  // Billing
  "billing.title": { en: "Billing", ru: "Оплата" },
  "billing.subtitle": { en: "Manage your subscription, usage, and invoices.", ru: "Управление подпиской, использованием и счетами." },
  "billing.current_usage": { en: "Current Usage", ru: "Текущее использование" },
  "billing.billing_cycle": { en: "Billing cycle", ru: "Период оплаты" },
  "billing.messages": { en: "Messages", ru: "Сообщения" },
  "billing.no_messages": { en: "No messages sent yet", ru: "Сообщений пока не отправлено" },
  "billing.quota_used": { en: "of your monthly quota used", ru: "месячной квоты использовано" },
  "billing.plans": { en: "Plans", ru: "Тарифы" },
  "billing.active": { en: "Active", ru: "Активен" },
  "billing.downgrade": { en: "Downgrade", ru: "Понизить" },
  "billing.current_plan": { en: "Current Plan", ru: "Текущий план" },
  "billing.upgrade": { en: "Upgrade", ru: "Повысить" },
  "billing.payment_method": { en: "Payment Method", ru: "Способ оплаты" },
  "billing.add_card": { en: "Add Card", ru: "Добавить карту" },
  "billing.no_payment": { en: "No payment method added yet.", ru: "Способ оплаты не добавлен." },
  "billing.invoices": { en: "Invoice History", ru: "История счетов" },
  "billing.no_invoices": { en: "No invoices yet.", ru: "Счетов пока нет." },
  "billing.agent": { en: "Agent", ru: "Агент" },
  "billing.agents": { en: "Agents", ru: "Агентов" },
  "billing.messages_mo": { en: "messages/mo", ru: "сообщ./мес" },
  "billing.telegram_only": { en: "Telegram only", ru: "Только Telegram" },
  "billing.community_support": { en: "Community support", ru: "Поддержка сообщества" },
  "billing.unlimited_agents": { en: "Unlimited Agents", ru: "Без ограничений" },
  "billing.all_platforms": { en: "All platforms", ru: "Все платформы" },
  "billing.priority_support": { en: "Priority support", ru: "Приоритетная поддержка" },
  "billing.custom_branding": { en: "Custom branding", ru: "Свой бренд" },
  "billing.everything_pro": { en: "Everything in Pro", ru: "Всё из Pro" },
  "billing.custom_integrations": { en: "Custom integrations", ru: "Свои интеграции" },
  "billing.dedicated_manager": { en: "Dedicated account manager", ru: "Персональный менеджер" },
  "billing.sla": { en: "SLA guarantee", ru: "Гарантия SLA" },

  // 404
  "notfound.title": { en: "Oops! Page not found", ru: "Страница не найдена" },
  "notfound.link": { en: "Return to Home", ru: "На главную" },

  // Loading
  "loading.gnome1": { en: "Our gnomes are forging your AI employee...", ru: "Гномы собирают вашего AI-сотрудника..." },
  "loading.gnome2": { en: "Equipping flower-selling modules...", ru: "Устанавливаем модули продаж..." },
  "loading.gnome3": { en: "Tightening constraint bolts...", ru: "Затягиваем болты ограничений..." },
  "loading.gnome4": { en: "Calibrating personality matrix...", ru: "Калибруем матрицу личности..." },

  // Wizard Steps
  "wizard.identity": { en: "Bot Identity", ru: "Идентичность" },
  "wizard.welcome": { en: "Welcome Experience", ru: "Приветствие" },
  "wizard.actions": { en: "Actions & Data", ru: "Действия" },
  "wizard.workflow": { en: "Logic & Workflow", ru: "Логика" },
  "wizard.preview": { en: "Behavior Preview", ru: "Превью" },
  "wizard.telegram_config": { en: "Telegram Config", ru: "Telegram" },
  "wizard.telegram_preview": { en: "Telegram Preview", ru: "Превью TG" },
  "wizard.deploy": { en: "Review & Deploy", ru: "Деплой" },
  "wizard.back": { en: "Back", ru: "Назад" },
  "wizard.next": { en: "Next", ru: "Далее" },
  "wizard.deploy_telegram": { en: "Deploy to Telegram", ru: "Развернуть в Telegram" },
  "wizard.deploying": { en: "Deploying...", ru: "Развёртывание..." },
  "wizard.deployed": { en: "Bot Deployed! 🎉", ru: "Бот развёрнут! 🎉" },
  "wizard.bot_live": { en: "Your bot is live at", ru: "Ваш бот доступен:" },
  "wizard.done": { en: "Done", ru: "Готово" },

  // Wizard Identity Step
  "wizard.define_identity": { en: "Define Your Bot's Identity", ru: "Определите идентичность бота" },
  "wizard.define_identity_desc": { en: "Set the name, appearance, and personality of your bot.", ru: "Задайте имя, внешний вид и характер бота." },
  "wizard.bot_name": { en: "Bot Name", ru: "Имя бота" },
  "wizard.username_hint": { en: "Username Hint", ru: "Юзернейм" },
  "wizard.short_desc": { en: "Short Description", ru: "Краткое описание" },
  "wizard.short_desc_placeholder": { en: "Describe what this bot does in one short sentence.", ru: "Опишите бота в одном предложении." },
  "wizard.about_bio": { en: "About / Bio", ru: "О боте" },
  "wizard.about_placeholder": { en: "Optional Telegram-style about text.", ru: "Текст «о боте» для Telegram (необязательно)." },
  "wizard.language": { en: "Language", ru: "Язык" },
  "wizard.tone": { en: "Tone", ru: "Тон" },
  "wizard.style": { en: "Style", ru: "Стиль" },

  // Wizard Welcome Step
  "wizard.welcome_title": { en: "Welcome Experience", ru: "Приветствие" },
  "wizard.welcome_desc": { en: "Configure the first impression when users start your bot.", ru: "Настройте первое впечатление при запуске бота." },
  "wizard.welcome_msg": { en: "Welcome Message", ru: "Приветственное сообщение" },
  "wizard.welcome_msg_placeholder": { en: "Write the first message the bot sends after /start.", ru: "Напишите первое сообщение после /start." },
  "wizard.starter_buttons": { en: "Starter Buttons", ru: "Кнопки быстрого старта" },
  "wizard.starter_placeholder": { en: "e.g., Place an order", ru: "напр., Сделать заказ" },
  "wizard.add": { en: "Add", ru: "Добавить" },
  "wizard.fallback_msg": { en: "Fallback Message", ru: "Сообщение при неизвестном запросе" },
  "wizard.fallback_placeholder": { en: "What should the bot say when it cannot help?", ru: "Что бот ответит, если не может помочь?" },

  // Wizard Actions Step
  "wizard.actions_title": { en: "What Your Bot Can Do", ru: "Что умеет ваш бот" },
  "wizard.actions_desc": { en: "Choose the bot type, actions, and data it should collect.", ru: "Выберите тип бота, действия и данные для сбора." },
  "wizard.bot_type": { en: "Bot Type", ru: "Тип бота" },
  "wizard.bot_actions": { en: "Bot Actions", ru: "Действия бота" },
  "wizard.data_fields": { en: "Data Collection Fields", ru: "Поля для сбора данных" },
  "wizard.data_fields_desc": { en: "Define what information the bot should collect from users.", ru: "Определите, какую информацию бот должен собирать." },
  "wizard.field_placeholder": { en: "e.g., Phone Number, Delivery Address", ru: "напр., Телефон, Адрес доставки" },
  "wizard.required": { en: "Required", ru: "Обязательное" },

  // Wizard Workflow Step
  "wizard.workflow_title": { en: "Logic & Workflow", ru: "Логика и процесс" },
  "wizard.workflow_desc": { en: "Define the sequence, branching rules, and integrations.", ru: "Определите последовательность, правила ветвления и интеграции." },
  "wizard.workflow_steps": { en: "Workflow Steps", ru: "Шаги процесса" },
  "wizard.workflow_steps_desc": { en: "Define the ordered sequence of actions your bot follows.", ru: "Задайте порядок действий бота." },
  "wizard.step_placeholder": { en: "e.g., Greet customer, Ask for order details", ru: "напр., Поприветствовать, Уточнить заказ" },
  "wizard.logic_rules": { en: "Logic Rules", ru: "Правила логики" },
  "wizard.logic_rules_desc": { en: "Define simple IF → THEN branching behavior.", ru: "Задайте простое ветвление ЕСЛИ → ТО." },
  "wizard.if_placeholder": { en: "If roses unavailable...", ru: "Если роз нет в наличии..." },
  "wizard.then_placeholder": { en: "Offer tulips instead", ru: "Предложить тюльпаны" },
  "wizard.external_actions": { en: "External Actions", ru: "Внешние действия" },
  "wizard.func_summary": { en: "Functional Summary", ru: "Сводка функций" },
  "wizard.summary_type": { en: "Type:", ru: "Тип:" },
  "wizard.summary_actions": { en: "Actions:", ru: "Действия:" },
  "wizard.summary_collects": { en: "Collects:", ru: "Собирает:" },
  "wizard.summary_workflow": { en: "Workflow:", ru: "Процесс:" },
  "wizard.summary_rules": { en: "Rules:", ru: "Правила:" },
  "wizard.summary_integrations": { en: "Integrations:", ru: "Интеграции:" },
  "wizard.summary_empty": { en: "No actions configured yet. Select a bot type and actions above.", ru: "Действия ещё не настроены. Выберите тип бота и действия." },
  "wizard.conditional_rules": { en: "conditional rules", ru: "условных правил" },
  "wizard.actions_count": { en: "actions", ru: "действий" },

  // Wizard Review
  "wizard.review_title": { en: "Review & Deploy", ru: "Проверка и деплой" },
  "wizard.review_desc": { en: "Review everything before deploying your bot.", ru: "Проверьте всё перед деплоем." },
  "wizard.identity_section": { en: "Identity", ru: "Идентичность" },
  "wizard.actions_data_section": { en: "Actions & Data", ru: "Действия и данные" },
  "wizard.logic_workflow_section": { en: "Logic & Workflow", ru: "Логика и процесс" },
  "wizard.telegram_section": { en: "Telegram", ru: "Telegram" },
  "wizard.name": { en: "Name", ru: "Имя" },
  "wizard.checklist": { en: "Deployment Checklist", ru: "Чеклист деплоя" },
  "wizard.confirm_label": { en: "I reviewed the bot identity, actions, Telegram settings, and preview before deployment.", ru: "Я проверил идентичность, действия, настройки Telegram и превью перед деплоем." },
  "wizard.fill_required": { en: "Please fill in all required fields before deploying.", ru: "Заполните все обязательные поля." },
  "wizard.display_name": { en: "Display Name", ru: "Отображаемое имя" },
  "wizard.commands": { en: "Commands", ru: "Команды" },
  "wizard.commands_count": { en: "commands", ru: "команд" },
  "wizard.steps_count": { en: "steps", ru: "шагов" },
  "wizard.rules_count": { en: "rules", ru: "правил" },
  "wizard.fields_count": { en: "fields", ru: "полей" },
  "wizard.configured": { en: "configured", ru: "настроено" },
  "wizard.data_fields_label": { en: "Data fields", ru: "Поля данных" },

  // Bot Types
  "bottype.sales": { en: "Sales Bot", ru: "Бот продаж" },
  "bottype.booking": { en: "Booking Bot", ru: "Бот бронирования" },
  "bottype.support": { en: "Support Bot", ru: "Бот поддержки" },
  "bottype.lead": { en: "Lead Qualification", ru: "Квалификация лидов" },
  "bottype.faq": { en: "FAQ Bot", ru: "FAQ бот" },
  "bottype.order": { en: "Order Bot", ru: "Бот заказов" },
  "bottype.custom": { en: "Custom Bot", ru: "Свой бот" },
  "bottype.sales_desc": { en: "Sell products & services", ru: "Продажа товаров и услуг" },
  "bottype.booking_desc": { en: "Manage appointments", ru: "Управление записями" },
  "bottype.support_desc": { en: "Handle customer issues", ru: "Решение вопросов клиентов" },
  "bottype.lead_desc": { en: "Qualify & capture leads", ru: "Квалификация лидов" },
  "bottype.faq_desc": { en: "Answer common questions", ru: "Ответы на частые вопросы" },
  "bottype.order_desc": { en: "Process orders", ru: "Обработка заказов" },
  "bottype.custom_desc": { en: "Build from scratch", ru: "Создать с нуля" },

  // Bot Actions
  "action.answer_questions": { en: "Answer questions", ru: "Отвечать на вопросы" },
  "action.recommend_products": { en: "Recommend products", ru: "Рекомендовать товары" },
  "action.collect_details": { en: "Collect customer details", ru: "Собирать данные клиента" },
  "action.create_booking": { en: "Create booking", ru: "Создать запись" },
  "action.reschedule": { en: "Reschedule booking", ru: "Перенести запись" },
  "action.cancel_booking": { en: "Cancel booking", ru: "Отменить запись" },
  "action.collect_lead": { en: "Collect lead information", ru: "Собрать лид" },
  "action.create_ticket": { en: "Create support ticket", ru: "Создать тикет" },
  "action.escalate": { en: "Escalate to human", ru: "Передать человеку" },
  "action.offer_alternatives": { en: "Offer alternatives", ru: "Предложить альтернативы" },
  "action.clarifying_questions": { en: "Ask clarifying questions", ru: "Уточняющие вопросы" },
  "action.send_confirmation": { en: "Send confirmation message", ru: "Отправить подтверждение" },
  "action.notify_manager": { en: "Notify manager", ru: "Уведомить менеджера" },
  "action.save_order": { en: "Save order", ru: "Сохранить заказ" },
  "action.save_lead": { en: "Save lead", ru: "Сохранить лид" },
  "action.send_webhook": { en: "Send webhook", ru: "Отправить вебхук" },

  // External Actions
  "ext.telegram_admin": { en: "Send order to Telegram admin", ru: "Отправить заказ в Telegram" },
  "ext.email_lead": { en: "Send lead to email", ru: "Отправить лид на email" },
  "ext.google_sheets": { en: "Save data to Google Sheets", ru: "Сохранить в Google Sheets" },
  "ext.webhook": { en: "Create webhook request", ru: "Создать вебхук-запрос" },
  "ext.crm_lead": { en: "Create CRM lead", ru: "Создать лид в CRM" },
  "ext.notify_support": { en: "Notify support team", ru: "Уведомить поддержку" },

  // Workflow Action Types
  "wf.ask_question": { en: "Ask Question", ru: "Задать вопрос" },
  "wf.recommend": { en: "Recommend", ru: "Рекомендовать" },
  "wf.collect_field": { en: "Collect Field", ru: "Собрать поле" },
  "wf.condition": { en: "Condition / Branch", ru: "Условие / Ветка" },
  "wf.confirm": { en: "Confirm", ru: "Подтвердить" },
  "wf.escalate": { en: "Escalate", ru: "Эскалация" },
  "wf.notify": { en: "Notify", ru: "Уведомить" },
  "wf.custom": { en: "Custom Action", ru: "Своё действие" },

  // Telegram Config Step
  "wizard.tg_config_title": { en: "Telegram Configuration", ru: "Настройка Telegram" },
  "wizard.tg_config_desc": { en: "Connect your bot to Telegram and configure its settings.", ru: "Подключите бота к Telegram и настройте параметры." },
  "wizard.get_token": { en: "Get your bot token", ru: "Получите токен бота" },
  "wizard.tg_step1": { en: "Open Telegram and search for", ru: "Откройте Telegram и найдите" },
  "wizard.tg_step2_send": { en: "Send", ru: "Отправьте" },
  "wizard.tg_step2_follow": { en: "and follow the instructions", ru: "и следуйте инструкциям" },
  "wizard.tg_step3": { en: "Copy the API token and paste it below", ru: "Скопируйте API токен и вставьте ниже" },
  "wizard.bot_token": { en: "Bot Token", ru: "Токен бота" },
  "wizard.webhook_mode": { en: "Webhook Mode", ru: "Режим вебхука" },
  "wizard.webhook_auto": { en: "Auto-generate", ru: "Автоматически" },
  "wizard.webhook_custom": { en: "Custom URL", ru: "Свой URL" },
  "wizard.custom_webhook_url": { en: "Custom Webhook URL", ru: "URL вебхука" },
  "wizard.tg_description": { en: "Telegram Description", ru: "Описание в Telegram" },
  "wizard.tg_about": { en: "Telegram About Text", ru: "Текст «О боте» в Telegram" },
  "wizard.bot_commands": { en: "Bot Commands", ru: "Команды бота" },
  "wizard.command_placeholder": { en: "/command", ru: "/команда" },
  "wizard.command_desc_placeholder": { en: "Description", ru: "Описание" },

  // Telegram Preview Step
  "wizard.tg_preview_title": { en: "Telegram Preview", ru: "Превью Telegram" },
  "wizard.tg_preview_desc": { en: "See how your bot will look and feel in Telegram.", ru: "Посмотрите, как бот будет выглядеть в Telegram." },
  "wizard.tab_profile": { en: "Profile", ru: "Профиль" },
  "wizard.tab_chat": { en: "Chat", ru: "Чат" },
  "wizard.tab_start": { en: "Start", ru: "Старт" },
  "wizard.info": { en: "Info", ru: "Инфо" },
  "wizard.bio": { en: "Bio", ru: "Био" },
  "wizard.description_label": { en: "Description", ru: "Описание" },
  "wizard.username_label": { en: "Username", ru: "Юзернейм" },
  "wizard.message_placeholder": { en: "Message", ru: "Сообщение" },

  // Behavior Preview Step
  "wizard.behavior_title": { en: "Behavior Preview", ru: "Превью поведения" },
  "wizard.behavior_desc": { en: "Review your bot's personality and see example replies.", ru: "Проверьте личность бота и посмотрите примеры ответов." },
  "wizard.personality_summary": { en: "Personality Summary", ru: "Сводка личности" },
  "wizard.example_replies": { en: "Example Replies", ru: "Примеры ответов" },
  "wizard.generate_previews": { en: "Generate Previews", ru: "Сгенерировать" },
  "wizard.generating": { en: "Generating...", ru: "Генерация..." },
  "wizard.click_generate": { en: "Click \"Generate Previews\" to see how your bot responds.", ru: "Нажмите «Сгенерировать», чтобы увидеть ответы бота." },
  "wizard.user_says": { en: "User:", ru: "Пользователь:" },

  // Field types
  "field.text": { en: "Text", ru: "Текст" },
  "field.phone": { en: "Phone", ru: "Телефон" },
  "field.date": { en: "Date", ru: "Дата" },
  "field.number": { en: "Number", ru: "Число" },
  "field.select": { en: "Select", ru: "Выбор" },
  "field.name_placeholder": { en: "Field name", ru: "Название поля" },
  "field.step_title": { en: "Step title", ru: "Название шага" },

  // Bot Type step (new first step)
  "wizard.step_bot_type":           { en: "Bot Type",              ru: "Тип бота" },
  "wizard.bot_type_title":          { en: "What kind of bot are you building?", ru: "Какой бот вам нужен?" },
  "wizard.bot_type_desc":           { en: "Choose the scenario — the wizard will adapt to show only what you need.", ru: "Выберите сценарий — визард покажет только нужные шаги." },
  "wizard.bot_type_selected_hint":  { en: "Great choice! Click Next to continue with a tailored setup.", ru: "Отличный выбор! Нажмите «Далее» для персонализированной настройки." },

  // API Keys step (BYOK)
  "wizard.step_api_keys":           { en: "API Keys",              ru: "API ключи" },
  "wizard.api_keys_title":          { en: "Power your bot's brain", ru: "Подключите мозг бота" },
  "wizard.api_keys_desc":           { en: "Your bot uses your OpenAI key. You pay only for what your bot uses.", ru: "Бот работает на вашем OpenAI ключе. Вы платите только за то, что использует ваш бот." },
  "wizard.openai_key_label":        { en: "OpenAI API Key",        ru: "OpenAI API ключ" },
  "wizard.openai_how_to_get":       { en: "How to get your key:",  ru: "Как получить ключ:" },
  "wizard.openai_step1":            { en: "Go to",                 ru: "Перейдите на" },
  "wizard.openai_step2":            { en: "Sign in / Sign up",     ru: "Войдите или зарегистрируйтесь" },
  "wizard.openai_step3":            { en: "Click «Create new secret key» and copy it", ru: "Нажмите «Create new secret key» и скопируйте" },
  "wizard.openai_key_invalid":      { en: "Key must start with sk-", ru: "Ключ должен начинаться с sk-" },
  "wizard.api_keys_security":       { en: "Your key is stored securely and only used to power your bot's responses. We never share it.", ru: "Ваш ключ хранится безопасно и используется только для ответов вашего бота. Мы его не передаём." },

  // Deploy wizard misc
  "wizard.avatar_uploaded": { en: "Avatar uploaded!", ru: "Аватар загружен!" },
  "wizard.upload_failed": { en: "Upload failed:", ru: "Ошибка загрузки:" },
  "wizard.no_agent": { en: "No agent selected", ru: "Агент не выбран" },
  "wizard.deploy_failed": { en: "Deployment failed", ru: "Ошибка деплоя" },
  "wizard.step_indicator": { en: "Step", ru: "Шаг" },

  // Wizard step titles (new)
  "wizard.connections": { en: "Connections", ru: "Подключения" },
  "wizard.data_mapping": { en: "Data & Mapping", ru: "Данные" },
  "wizard.triggers": { en: "Triggers", ru: "Триггеры" },

  // Connections step
  "wizard.conn_title": { en: "Connect Services", ru: "Подключение сервисов" },
  "wizard.conn_desc": { en: "Choose which external services your bot can use.", ru: "Выберите внешние сервисы для вашего бота." },
  "wizard.conn_gallery": { en: "Available Connectors", ru: "Доступные коннекторы" },
  "wizard.conn_connected": { en: "Connected Services", ru: "Подключённые сервисы" },
  "wizard.conn_status_ok": { en: "Connected", ru: "Подключено" },
  "wizard.conn_status_pending": { en: "Pending", ru: "Ожидает" },
  "wizard.conn_rw": { en: "Read & Write", ru: "Чтение и запись" },
  "wizard.conn_read": { en: "Read only", ru: "Только чтение" },
  "wizard.conn_write": { en: "Write only", ru: "Только запись" },
  "wizard.conn_empty": { en: "No services connected yet. Click a connector above to add it.", ru: "Сервисы ещё не подключены. Нажмите на коннектор выше." },
  "conn.google_sheets": { en: "Google Sheets", ru: "Google Таблицы" },
  "conn.airtable": { en: "Airtable", ru: "Airtable" },
  "conn.google_calendar": { en: "Google Calendar", ru: "Google Календарь" },
  "conn.telegram_admin": { en: "Telegram Admin", ru: "Telegram Админ" },
  "conn.email": { en: "Email (SMTP)", ru: "Email (SMTP)" },
  "conn.webhook": { en: "Custom Webhook", ru: "Вебхук" },
  "conn.shopify": { en: "Shopify", ru: "Shopify" },
  "conn.woocommerce": { en: "WooCommerce", ru: "WooCommerce" },
  "conn.custom_api": { en: "Custom REST API", ru: "REST API" },
  "conn.cat_spreadsheet": { en: "Spreadsheet", ru: "Таблицы" },
  "conn.cat_database": { en: "Database", ru: "База данных" },
  "conn.cat_calendar": { en: "Calendar", ru: "Календарь" },
  "conn.cat_messaging": { en: "Messaging", ru: "Мессенджер" },
  "conn.cat_notifications": { en: "Notifications", ru: "Уведомления" },
  "conn.cat_automation": { en: "Automation", ru: "Автоматизация" },
  "conn.cat_store": { en: "Store", ru: "Магазин" },
  "conn.cat_advanced": { en: "Advanced", ru: "Продвинутое" },

  // Data Sources & Mapping step
  "wizard.ds_title": { en: "Data Sources & Mapping", ru: "Источники данных и маппинг" },
  "wizard.ds_desc": { en: "Define where the bot reads from, writes to, and how fields are mapped.", ru: "Определите, откуда бот читает, куда пишет и как маппить поля." },
  "wizard.ds_read": { en: "Read Sources", ru: "Источники чтения" },
  "wizard.ds_read_desc": { en: "External data the bot can read.", ru: "Внешние данные, которые бот может читать." },
  "wizard.ds_write": { en: "Write Destinations", ru: "Назначения записи" },
  "wizard.ds_write_desc": { en: "Where the bot sends or saves data.", ru: "Куда бот отправляет или сохраняет данные." },
  "wizard.ds_add": { en: "Add Data Source", ru: "Добавить источник данных" },
  "wizard.ds_source_name": { en: "Source name", ru: "Название источника" },
  "wizard.ds_select_connector": { en: "Select connector", ru: "Выберите коннектор" },
  "wizard.ds_resource": { en: "Resource (sheet, table...)", ru: "Ресурс (лист, таблица...)" },
  "wizard.ds_mode_read": { en: "Read", ru: "Чтение" },
  "wizard.ds_mode_write": { en: "Write", ru: "Запись" },
  "wizard.ds_purpose": { en: "Purpose (e.g., Check product availability)", ru: "Цель (напр., Проверить наличие товара)" },
  "wizard.ds_connect_first": { en: "Connect a service first to add data sources.", ru: "Сначала подключите сервис, чтобы добавить источники данных." },
  "wizard.fm_title": { en: "Field Mapping", ru: "Маппинг полей" },
  "wizard.fm_desc": { en: "Map bot fields to external system fields.", ru: "Сопоставьте поля бота с полями внешних систем." },
  "wizard.fm_bot_field": { en: "Bot field", ru: "Поле бота" },
  "wizard.fm_dest": { en: "Destination", ru: "Назначение" },
  "wizard.fm_ext_field": { en: "External field", ru: "Внешнее поле" },
  "transform.none": { en: "None", ru: "Без изменений" },
  "transform.lowercase": { en: "Lowercase", ru: "В нижний регистр" },
  "transform.uppercase": { en: "Uppercase", ru: "В верхний регистр" },
  "transform.date_format": { en: "Date format", ru: "Формат даты" },
  "transform.phone_normalize": { en: "Phone normalize", ru: "Нормализ. телефон" },

  // Triggers step
  "wizard.trig_title": { en: "Actions & Triggers", ru: "Действия и триггеры" },
  "wizard.trig_desc": { en: "Define what the bot does with external systems and when.", ru: "Определите, что бот делает с внешними системами и когда." },
  "wizard.trig_actions": { en: "Action Triggers", ru: "Триггеры действий" },
  "wizard.trig_name_ph": { en: "Trigger name", ru: "Название триггера" },
  "wizard.trig_action_ph": { en: "Select action", ru: "Выберите действие" },
  "wizard.trig_dest_ph": { en: "Target destination", ru: "Целевое назначение" },
  "wizard.trig_rules": { en: "Integration Rules", ru: "Правила интеграции" },
  "wizard.trig_if_ph": { en: "If order is confirmed...", ru: "Если заказ подтверждён..." },
  "wizard.trig_then_ph": { en: "Save order to Google Sheets", ru: "Сохранить заказ в Google Таблицы" },
  "wizard.trig_summary": { en: "Integration Summary", ru: "Сводка интеграций" },
  "wizard.trig_sum_conn": { en: "Connected:", ru: "Подключено:" },
  "wizard.trig_sum_reads": { en: "Reads from:", ru: "Читает из:" },
  "wizard.trig_sum_writes": { en: "Writes to:", ru: "Пишет в:" },
  "wizard.trig_sum_triggers": { en: "Triggers:", ru: "Триггеры:" },
  "wizard.trig_sum_mappings": { en: "Mappings:", ru: "Маппинги:" },
  "wizard.trig_sum_rules": { en: "Rules:", ru: "Правила:" },
  "wizard.trig_sum_empty": { en: "No integrations configured yet.", ru: "Интеграции ещё не настроены." },
  "trigger.after_fields": { en: "After required fields collected", ru: "После сбора обязательных полей" },
  "trigger.after_confirm": { en: "After user confirmation", ru: "После подтверждения пользователем" },
  "trigger.on_urgent": { en: "On urgent issue", ru: "При срочной проблеме" },
  "trigger.on_lead": { en: "On new lead", ru: "При новом лиде" },
  "trigger.on_booking": { en: "On booking confirmed", ru: "При подтверждении записи" },
  "trigger.on_review": { en: "On manual review", ru: "При ручной проверке" },
  "trigger.on_every_msg": { en: "On every message", ru: "При каждом сообщении" },
  "trigger.custom": { en: "Custom condition", ru: "Своё условие" },
  "trigger.policy_ask": { en: "Ask before send", ru: "Спросить перед отправкой" },
  "trigger.policy_auto": { en: "Automatic", ru: "Автоматически" },
  "trigger.policy_draft": { en: "Draft only", ru: "Только черновик" },
  "trig_act.check_avail": { en: "Check availability", ru: "Проверить наличие" },
  "trig_act.create_order": { en: "Create order", ru: "Создать заказ" },
  "trig_act.update_order": { en: "Update order", ru: "Обновить заказ" },
  "trig_act.create_booking": { en: "Create booking", ru: "Создать запись" },
  "trig_act.reschedule": { en: "Reschedule booking", ru: "Перенести запись" },
  "trig_act.cancel_booking": { en: "Cancel booking", ru: "Отменить запись" },
  "trig_act.create_ticket": { en: "Create support ticket", ru: "Создать тикет" },
  "trig_act.create_lead": { en: "Create lead", ru: "Создать лид" },
  "trig_act.save_sheets": { en: "Save to Google Sheets", ru: "Сохранить в Google Таблицы" },
  "trig_act.send_email": { en: "Send email notification", ru: "Отправить email" },
  "trig_act.send_tg": { en: "Send Telegram notification", ru: "Отправить уведомление в Telegram" },
  "trig_act.call_webhook": { en: "Call webhook", ru: "Вызвать вебхук" },
  "trig_act.call_api": { en: "Call custom API", ru: "Вызвать API" },

  // Languages
  "lang.English": { en: "English", ru: "Английский" },
  "lang.Russian": { en: "Russian", ru: "Русский" },
  "lang.Hebrew": { en: "Hebrew", ru: "Иврит" },
  "lang.Arabic": { en: "Arabic", ru: "Арабский" },
  "lang.Spanish": { en: "Spanish", ru: "Испанский" },
  "lang.French": { en: "French", ru: "Французский" },
  "lang.German": { en: "German", ru: "Немецкий" },
  "lang.Other": { en: "Other", ru: "Другой" },

  // Tones
  "tone.Friendly": { en: "Friendly", ru: "Дружелюбный" },
  "tone.Professional": { en: "Professional", ru: "Профессиональный" },
  "tone.Formal": { en: "Formal", ru: "Формальный" },
  "tone.Supportive": { en: "Supportive", ru: "Поддерживающий" },
  "tone.Playful": { en: "Playful", ru: "Игривый" },
  "tone.Concise": { en: "Concise", ru: "Лаконичный" },

  // Response Styles
  "style.Concise": { en: "Concise", ru: "Кратко" },
  "style.Detailed": { en: "Detailed", ru: "Подробно" },
  "style.Step-by-step": { en: "Step-by-step", ru: "Пошагово" },
  "style.Bullet points": { en: "Bullet points", ru: "Тезисно" },
  "style.Conversational": { en: "Conversational", ru: "Разговорный" },

  // Agent statuses
  "status.active": { en: "Active", ru: "Активен" },
  "status.paused": { en: "Paused", ru: "Пауза" },
  "status.draft": { en: "Draft", ru: "Черновик" },

  // Agent errors
  "agents.load_failed": { en: "Failed to load agents", ru: "Не удалось загрузить агентов" },
  "agents.update_failed": { en: "Failed to update agent", ru: "Не удалось обновить агента" },
  "agents.delete_failed": { en: "Failed to delete agent", ru: "Не удалось удалить агента" },
  "agents.platform_none": { en: "none", ru: "нет" },

  // Avatar Upload
  "avatar.change": { en: "Change avatar", ru: "Сменить аватар" },
  "avatar.upload": { en: "Upload avatar", ru: "Загрузить аватар" },
  "avatar.crop_title": { en: "Crop Avatar", ru: "Обрезка аватара" },
  "avatar.cancel": { en: "Cancel", ru: "Отмена" },
  "avatar.apply": { en: "Apply", ru: "Применить" },

  // Deploy Modal (legacy)
  "deploy.title": { en: "Deploy Your Bot", ru: "Развёртывание бота" },
  "deploy.subtitle": { en: "Choose a platform and connect your bot.", ru: "Выберите платформу и подключите бота." },
  "deploy.bot_deployed": { en: "Bot Deployed!", ru: "Бот развёрнут!" },
  "deploy.bot_live": { en: "Your bot is live at", ru: "Ваш бот доступен:" },
  "deploy.done": { en: "Done", ru: "Готово" },
  "deploy.bot_token": { en: "Bot Token", ru: "Токен бота" },
  "deploy.deploying": { en: "Deploying...", ru: "Развёртывание..." },
  "deploy.deploy_tg": { en: "Deploy to Telegram", ru: "Развернуть в Telegram" },
  "deploy.no_agent": { en: "No agent selected for deployment", ru: "Агент не выбран для деплоя" },
  "deploy.failed": { en: "Deployment failed", ru: "Ошибка деплоя" },
  "deploy.wa_phone": { en: "Phone Number ID", ru: "ID номера телефона" },
  "deploy.wa_token": { en: "Access Token", ru: "Токен доступа" },
  "deploy.coming_soon": { en: "Coming Soon", ru: "Скоро" },
  "deploy.pro_plan": { en: "BotForge Pro Plan", ru: "BotForge Pro" },
  "deploy.pro_desc": { en: "Unlimited agents • Priority support", ru: "Без ограничений • Приоритетная поддержка" },
  "deploy.tg_step1": { en: "Open Telegram and search for @BotFather", ru: "Откройте Telegram и найдите @BotFather" },
  "deploy.tg_step2": { en: "Send /newbot and follow the instructions to create your bot", ru: "Отправьте /newbot и следуйте инструкциям" },
  "deploy.tg_step3": { en: "Copy the API token and paste it below", ru: "Скопируйте API токен и вставьте ниже" },
  "deploy.wa_step1": { en: "Go to Meta Business Suite and create a WhatsApp Business App", ru: "Перейдите в Meta Business Suite и создайте приложение WhatsApp Business" },
  "deploy.wa_step2": { en: "Get your Phone Number ID and Access Token from the API settings", ru: "Получите Phone Number ID и Access Token из настроек API" },
  "deploy.wa_step3": { en: "Paste both credentials below", ru: "Вставьте оба ключа ниже" },
} as const;

type TranslationKey = keyof typeof translations;

interface I18nContextType {
  lang: Lang;
  setLang: (lang: Lang) => void;
  t: (key: TranslationKey) => string;
}

const I18nContext = createContext<I18nContextType>({
  lang: "ru",
  setLang: () => {},
  t: (key) => key,
});

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(() => {
    return (localStorage.getItem("app_lang") as Lang) || "ru";
  });

  const setLang = (newLang: Lang) => {
    setLangState(newLang);
    localStorage.setItem("app_lang", newLang);
  };

  const t = (key: TranslationKey): string => {
    const entry = translations[key];
    if (!entry) return key;
    return entry[lang] || entry.en || key;
  };

  return (
    <I18nContext.Provider value={{ lang, setLang, t }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n() {
  return useContext(I18nContext);
}
