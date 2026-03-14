import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { WizardData, WorkflowStep, LogicRule, EXTERNAL_ACTIONS, WORKFLOW_ACTION_TYPES } from "./types";
import { Plus, X, ArrowRight, GitBranch, Workflow, Plug, ClipboardList, ChevronDown, ChevronUp } from "lucide-react";

interface Props {
  data: WizardData;
  onChange: (patch: Partial<WizardData>) => void;
}

export function StepWorkflowLogic({ data, onChange }: Props) {
  const [newStepTitle, setNewStepTitle] = useState("");
  const [newIfCondition, setNewIfCondition] = useState("");
  const [newThenAction, setNewThenAction] = useState("");
  const [showSummary, setShowSummary] = useState(false);

  // Workflow steps
  const addStep = () => {
    if (!newStepTitle.trim()) return;
    const step: WorkflowStep = {
      id: crypto.randomUUID(),
      title: newStepTitle.trim(),
      action_type: "ask_question",
    };
    onChange({ workflow_steps: [...data.workflow_steps, step] });
    setNewStepTitle("");
  };

  const updateStep = (id: string, patch: Partial<WorkflowStep>) => {
    onChange({
      workflow_steps: data.workflow_steps.map((s) => (s.id === id ? { ...s, ...patch } : s)),
    });
  };

  const removeStep = (id: string) => {
    onChange({ workflow_steps: data.workflow_steps.filter((s) => s.id !== id) });
  };

  const moveStep = (idx: number, dir: -1 | 1) => {
    const arr = [...data.workflow_steps];
    const target = idx + dir;
    if (target < 0 || target >= arr.length) return;
    [arr[idx], arr[target]] = [arr[target], arr[idx]];
    onChange({ workflow_steps: arr });
  };

  // Logic rules
  const addRule = () => {
    if (!newIfCondition.trim() || !newThenAction.trim()) return;
    const rule: LogicRule = {
      id: crypto.randomUUID(),
      if_condition: newIfCondition.trim(),
      then_action: newThenAction.trim(),
    };
    onChange({ logic_rules: [...data.logic_rules, rule] });
    setNewIfCondition("");
    setNewThenAction("");
  };

  const removeRule = (id: string) => {
    onChange({ logic_rules: data.logic_rules.filter((r) => r.id !== id) });
  };

  // External actions
  const toggleExternal = (action: string) => {
    const next = data.external_actions.includes(action)
      ? data.external_actions.filter((a) => a !== action)
      : [...data.external_actions, action];
    onChange({ external_actions: next });
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="text-center space-y-1">
        <h2 className="text-xl font-bold text-foreground">Logic & Workflow</h2>
        <p className="text-sm text-muted-foreground">Define the sequence, branching rules, and integrations.</p>
      </div>

      {/* Workflow Steps */}
      <div className="space-y-3">
        <Label className="flex items-center gap-1.5 text-sm font-medium">
          <Workflow className="h-3.5 w-3.5" /> Workflow Steps
        </Label>
        <p className="text-xs text-muted-foreground">Define the ordered sequence of actions your bot follows.</p>

        {data.workflow_steps.length > 0 && (
          <div className="space-y-2">
            {data.workflow_steps.map((step, idx) => (
              <Card key={step.id} className="p-3 bg-muted/20 flex items-center gap-3">
                <div className="flex flex-col gap-0.5">
                  <button onClick={() => moveStep(idx, -1)} disabled={idx === 0} className="text-muted-foreground hover:text-foreground disabled:opacity-30">
                    <ChevronUp className="h-3 w-3" />
                  </button>
                  <button onClick={() => moveStep(idx, 1)} disabled={idx === data.workflow_steps.length - 1} className="text-muted-foreground hover:text-foreground disabled:opacity-30">
                    <ChevronDown className="h-3 w-3" />
                  </button>
                </div>
                <span className="text-xs font-bold text-primary w-5 text-center">{idx + 1}</span>
                <div className="flex-1 grid grid-cols-2 gap-2 items-center">
                  <Input
                    value={step.title}
                    onChange={(e) => updateStep(step.id, { title: e.target.value })}
                    className="h-8 text-xs bg-background/50"
                    placeholder="Step title"
                  />
                  <Select value={step.action_type} onValueChange={(v) => updateStep(step.id, { action_type: v })}>
                    <SelectTrigger className="h-8 text-xs bg-background/50">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {WORKFLOW_ACTION_TYPES.map((at) => (
                        <SelectItem key={at.value} value={at.value}>{at.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <button onClick={() => removeStep(step.id)} className="text-muted-foreground hover:text-destructive">
                  <X className="h-3.5 w-3.5" />
                </button>
              </Card>
            ))}
          </div>
        )}

        <div className="flex gap-2">
          <Input
            value={newStepTitle}
            onChange={(e) => setNewStepTitle(e.target.value)}
            placeholder="e.g., Greet customer, Ask for order details"
            className="bg-background/50"
            onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addStep())}
          />
          <Button variant="outline" size="sm" onClick={addStep} className="shrink-0 gap-1">
            <Plus className="h-3.5 w-3.5" /> Add
          </Button>
        </div>
      </div>

      {/* Logic Rules */}
      <div className="space-y-3">
        <Label className="flex items-center gap-1.5 text-sm font-medium">
          <GitBranch className="h-3.5 w-3.5" /> Logic Rules
        </Label>
        <p className="text-xs text-muted-foreground">Define simple IF → THEN branching behavior.</p>

        {data.logic_rules.length > 0 && (
          <div className="space-y-2">
            {data.logic_rules.map((rule) => (
              <Card key={rule.id} className="p-3 bg-muted/20 flex items-center gap-2">
                <span className="text-xs font-bold text-primary shrink-0">IF</span>
                <span className="text-xs text-foreground flex-1 truncate">{rule.if_condition}</span>
                <ArrowRight className="h-3 w-3 text-muted-foreground shrink-0" />
                <span className="text-xs font-bold text-success shrink-0">THEN</span>
                <span className="text-xs text-foreground flex-1 truncate">{rule.then_action}</span>
                <button onClick={() => removeRule(rule.id)} className="text-muted-foreground hover:text-destructive shrink-0">
                  <X className="h-3.5 w-3.5" />
                </button>
              </Card>
            ))}
          </div>
        )}

        <div className="grid grid-cols-[1fr_auto_1fr_auto] gap-2 items-center">
          <Input
            value={newIfCondition}
            onChange={(e) => setNewIfCondition(e.target.value)}
            placeholder="If roses unavailable..."
            className="bg-background/50 text-xs"
          />
          <ArrowRight className="h-4 w-4 text-muted-foreground" />
          <Input
            value={newThenAction}
            onChange={(e) => setNewThenAction(e.target.value)}
            placeholder="Offer tulips instead"
            className="bg-background/50 text-xs"
          />
          <Button variant="outline" size="sm" onClick={addRule} className="shrink-0 gap-1" disabled={!newIfCondition.trim() || !newThenAction.trim()}>
            <Plus className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {/* External Actions */}
      <div className="space-y-3">
        <Label className="flex items-center gap-1.5 text-sm font-medium">
          <Plug className="h-3.5 w-3.5" /> External Actions
        </Label>
        <div className="flex flex-wrap gap-2">
          {EXTERNAL_ACTIONS.map((action) => (
            <button
              key={action}
              onClick={() => toggleExternal(action)}
              className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition-all ${
                data.external_actions.includes(action)
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border bg-card/50 text-muted-foreground hover:border-primary/30"
              }`}
            >
              {action}
            </button>
          ))}
        </div>
      </div>

      {/* Summary Panel */}
      <button
        onClick={() => setShowSummary(!showSummary)}
        className="w-full flex items-center justify-between rounded-lg border border-border p-3 bg-muted/20 hover:bg-muted/30 transition-colors"
      >
        <span className="flex items-center gap-2 text-sm font-medium text-foreground">
          <ClipboardList className="h-4 w-4 text-primary" /> Functional Summary
        </span>
        {showSummary ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
      </button>

      {showSummary && (
        <Card className="p-4 bg-muted/20 space-y-3 text-sm">
          {data.bot_type && (
            <p><span className="text-muted-foreground">Type:</span> <span className="font-medium text-foreground">{data.bot_type}</span></p>
          )}
          {data.bot_actions.length > 0 && (
            <div>
              <span className="text-muted-foreground">Actions:</span>
              <span className="ml-1 text-foreground">{data.bot_actions.join(", ")}</span>
            </div>
          )}
          {data.data_fields.length > 0 && (
            <div>
              <span className="text-muted-foreground">Collects:</span>
              <span className="ml-1 text-foreground">
                {data.data_fields.map((f) => `${f.label}${f.required ? " *" : ""}`).join(", ")}
              </span>
            </div>
          )}
          {data.workflow_steps.length > 0 && (
            <div>
              <span className="text-muted-foreground">Workflow:</span>
              <span className="ml-1 text-foreground">
                {data.workflow_steps.map((s, i) => `${i + 1}. ${s.title}`).join(" → ")}
              </span>
            </div>
          )}
          {data.logic_rules.length > 0 && (
            <div>
              <span className="text-muted-foreground">Rules:</span>
              <span className="ml-1 text-foreground">{data.logic_rules.length} conditional rules</span>
            </div>
          )}
          {data.external_actions.length > 0 && (
            <div>
              <span className="text-muted-foreground">Integrations:</span>
              <span className="ml-1 text-foreground">{data.external_actions.join(", ")}</span>
            </div>
          )}
          {!data.bot_type && data.bot_actions.length === 0 && data.data_fields.length === 0 && (
            <p className="text-muted-foreground italic">No actions configured yet. Select a bot type and actions above.</p>
          )}
        </Card>
      )}
    </div>
  );
}
