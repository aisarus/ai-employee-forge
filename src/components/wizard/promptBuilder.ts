import type { WizardData } from "./types";
import { BOT_TYPES } from "./types";

/**
 * Converts the wizard's actions/workflow/logic configuration
 * into a prompt block that gets appended to the system prompt.
 */
export function buildActionsPromptBlock(data: WizardData): string {
  const sections: string[] = [];

  // Bot type context
  if (data.bot_type) {
    const bt = BOT_TYPES.find((t) => t.id === data.bot_type);
    if (bt) {
      sections.push(`### BOT_TYPE\nYou are a ${bt.label}. ${bt.desc}.`);
    }
  }

  // Actions
  if (data.bot_actions.length > 0) {
    const list = data.bot_actions.map((a, i) => `${i + 1}. ${a}`).join("\n");
    sections.push(`### CONFIGURED_ACTIONS\nYou are capable of performing the following actions:\n${list}`);
  }

  // Data collection
  if (data.data_fields.length > 0) {
    const sorted = [...data.data_fields].sort((a, b) => a.ask_order - b.ask_order);
    const fields = sorted
      .map((f) => `- ${f.label} (${f.type}${f.required ? ", required" : ", optional"})`)
      .join("\n");
    sections.push(
      `### DATA_COLLECTION\nCollect the following information from the user in this order. Ask only for fields not yet provided:\n${fields}`
    );
  }

  // Workflow
  if (data.workflow_steps.length > 0) {
    const steps = data.workflow_steps
      .map((s, i) => `${i + 1}. [${s.action_type.toUpperCase()}] ${s.title}`)
      .join("\n");
    sections.push(`### CONFIGURED_WORKFLOW\nFollow this sequence of steps:\n${steps}`);
  }

  // Logic rules
  if (data.logic_rules.length > 0) {
    const rules = data.logic_rules
      .map((r) => `- IF: ${r.if_condition} → THEN: ${r.then_action}`)
      .join("\n");
    sections.push(`### LOGIC_RULES\nApply these conditional rules:\n${rules}`);
  }

  // External actions
  if (data.external_actions.length > 0) {
    const list = data.external_actions.map((a) => `- ${a}`).join("\n");
    sections.push(
      `### EXTERNAL_ACTIONS\nAfter completing the workflow, perform these external actions when applicable:\n${list}`
    );
  }

  // --- Integration sections ---

  // Data Sources
  const readSources = data.data_sources.filter((ds) => ds.mode === "read");
  const writeSources = data.data_sources.filter((ds) => ds.mode === "write");

  if (readSources.length > 0) {
    const list = readSources
      .map((ds) => `- ${ds.name} (via ${ds.connector_id}, resource: ${ds.resource_name}): ${ds.purpose}`)
      .join("\n");
    sections.push(`### DATA_SOURCES\nYou can read information from the following sources:\n${list}`);
  }

  if (writeSources.length > 0) {
    const list = writeSources
      .map((ds) => `- ${ds.name} (via ${ds.connector_id}, resource: ${ds.resource_name}): ${ds.purpose}`)
      .join("\n");
    sections.push(`### WRITE_DESTINATIONS\nYou can save or send data to the following destinations:\n${list}`);
  }

  // Field Mappings
  if (data.field_mappings.length > 0) {
    const maps = data.field_mappings
      .map((fm) => {
        const ds = data.data_sources.find((d) => d.id === fm.data_source_id);
        const transform = fm.transform !== "none" ? ` [transform: ${fm.transform}]` : "";
        return `- bot.${fm.bot_field} → ${ds?.name || "unknown"}.${fm.external_field}${fm.required ? " (required)" : ""}${transform}`;
      })
      .join("\n");
    sections.push(`### FIELD_MAPPINGS\nWhen sending data to external systems, use these field mappings:\n${maps}`);
  }

  // Action Triggers
  if (data.action_triggers.length > 0) {
    const triggers = data.action_triggers
      .map((tr) => {
        const dest = tr.target_destination ? ` → ${tr.target_destination}` : "";
        const policy = tr.confirmation_policy === "ask_before_send" ? " (ask user first)" : tr.confirmation_policy === "draft_only" ? " (draft only)" : "";
        return `- ${tr.name}: WHEN ${tr.when.replace(/_/g, " ")} → ${tr.action_type}${dest}${policy}`;
      })
      .join("\n");
    sections.push(`### ACTION_TRIGGERS\nExecute these actions at the specified times:\n${triggers}`);
  }

  // Integration Rules
  if (data.integration_rules.length > 0) {
    const rules = data.integration_rules
      .map((r) => `- IF: ${r.if_condition} → THEN: ${r.then_action}`)
      .join("\n");
    sections.push(`### INTEGRATION_RULES\nApply these integration-specific conditional rules:\n${rules}`);
  }

  return sections.join("\n\n");
}
