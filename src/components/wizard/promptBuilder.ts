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

  return sections.join("\n\n");
}
