import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { WizardData, DataSource, FieldMapping, TRANSFORM_OPTIONS } from "./types";
import { Plus, X, ArrowRight, Database, FileOutput, Link2, GripVertical } from "lucide-react";
import { useI18n } from "@/hooks/useI18n";

interface Props {
  data: WizardData;
  onChange: (patch: Partial<WizardData>) => void;
}

const TRANSFORM_KEYS: Record<string, string> = {
  none: "transform.none",
  lowercase: "transform.lowercase",
  uppercase: "transform.uppercase",
  date_format: "transform.date_format",
  phone_normalize: "transform.phone_normalize",
};

export function StepDataMapping({ data, onChange }: Props) {
  const { t } = useI18n();
  const [newSourceName, setNewSourceName] = useState("");
  const [newSourceMode, setNewSourceMode] = useState<"read" | "write">("read");
  const [newSourceConnector, setNewSourceConnector] = useState("");
  const [newSourceResource, setNewSourceResource] = useState("");
  const [newSourcePurpose, setNewSourcePurpose] = useState("");

  const [newMapBotField, setNewMapBotField] = useState("");
  const [newMapDsId, setNewMapDsId] = useState("");
  const [newMapExtField, setNewMapExtField] = useState("");

  const connectorNames = data.connectors.reduce<Record<string, string>>((acc, c) => {
    acc[c.type] = c.display_name;
    return acc;
  }, {});

  const addDataSource = () => {
    if (!newSourceName.trim() || !newSourceConnector) return;
    const ds: DataSource = {
      id: crypto.randomUUID(),
      connector_id: newSourceConnector,
      name: newSourceName.trim(),
      resource_name: newSourceResource.trim(),
      mode: newSourceMode,
      purpose: newSourcePurpose.trim(),
    };
    onChange({ data_sources: [...data.data_sources, ds] });
    setNewSourceName("");
    setNewSourceResource("");
    setNewSourcePurpose("");
  };

  const removeDataSource = (id: string) => {
    onChange({
      data_sources: data.data_sources.filter((ds) => ds.id !== id),
      field_mappings: data.field_mappings.filter((fm) => fm.data_source_id !== id),
    });
  };

  const addMapping = () => {
    if (!newMapBotField.trim() || !newMapDsId || !newMapExtField.trim()) return;
    const fm: FieldMapping = {
      id: crypto.randomUUID(),
      bot_field: newMapBotField.trim(),
      data_source_id: newMapDsId,
      external_field: newMapExtField.trim(),
      required: true,
      transform: "none",
    };
    onChange({ field_mappings: [...data.field_mappings, fm] });
    setNewMapBotField("");
    setNewMapExtField("");
  };

  const updateMapping = (id: string, patch: Partial<FieldMapping>) => {
    onChange({ field_mappings: data.field_mappings.map((m) => (m.id === id ? { ...m, ...patch } : m)) });
  };

  const removeMapping = (id: string) => {
    onChange({ field_mappings: data.field_mappings.filter((m) => m.id !== id) });
  };

  const readSources = data.data_sources.filter((ds) => ds.mode === "read");
  const writeSources = data.data_sources.filter((ds) => ds.mode === "write");

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="text-center space-y-1">
        <h2 className="text-xl font-bold text-foreground">{t("wizard.ds_title")}</h2>
        <p className="text-sm text-muted-foreground">{t("wizard.ds_desc")}</p>
      </div>

      {/* Read Sources */}
      <div className="space-y-3">
        <Label className="flex items-center gap-1.5 text-sm font-medium">
          <Database className="h-3.5 w-3.5" /> {t("wizard.ds_read")}
        </Label>
        <p className="text-xs text-muted-foreground">{t("wizard.ds_read_desc")}</p>
        {readSources.map((ds) => (
          <Card key={ds.id} className="p-3 bg-muted/20 flex items-center gap-3">
            <Database className="h-4 w-4 text-primary shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground">{ds.name}</p>
              <p className="text-[10px] text-muted-foreground">{connectorNames[ds.connector_id] || ds.connector_id} → {ds.resource_name}</p>
            </div>
            <span className="text-[10px] text-muted-foreground max-w-[120px] truncate">{ds.purpose}</span>
            <button onClick={() => removeDataSource(ds.id)} className="text-muted-foreground hover:text-destructive shrink-0">
              <X className="h-3.5 w-3.5" />
            </button>
          </Card>
        ))}
      </div>

      {/* Write Destinations */}
      <div className="space-y-3">
        <Label className="flex items-center gap-1.5 text-sm font-medium">
          <FileOutput className="h-3.5 w-3.5" /> {t("wizard.ds_write")}
        </Label>
        <p className="text-xs text-muted-foreground">{t("wizard.ds_write_desc")}</p>
        {writeSources.map((ds) => (
          <Card key={ds.id} className="p-3 bg-muted/20 flex items-center gap-3">
            <FileOutput className="h-4 w-4 text-success shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground">{ds.name}</p>
              <p className="text-[10px] text-muted-foreground">{connectorNames[ds.connector_id] || ds.connector_id} → {ds.resource_name}</p>
            </div>
            <span className="text-[10px] text-muted-foreground max-w-[120px] truncate">{ds.purpose}</span>
            <button onClick={() => removeDataSource(ds.id)} className="text-muted-foreground hover:text-destructive shrink-0">
              <X className="h-3.5 w-3.5" />
            </button>
          </Card>
        ))}
      </div>

      {/* Add Data Source */}
      {data.connectors.length > 0 ? (
        <Card className="p-4 space-y-3 bg-background/50 border-dashed">
          <p className="text-xs font-medium text-foreground">{t("wizard.ds_add")}</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <Input value={newSourceName} onChange={(e) => setNewSourceName(e.target.value)} placeholder={t("wizard.ds_source_name")} className="h-8 text-xs bg-background/50" />
            <Select value={newSourceConnector} onValueChange={setNewSourceConnector}>
              <SelectTrigger className="h-8 text-xs bg-background/50" aria-label="Select connector"><SelectValue placeholder={t("wizard.ds_select_connector")} /></SelectTrigger>
              <SelectContent>
                {data.connectors.map((c) => (
                  <SelectItem key={c.id} value={c.type}>{c.display_name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input value={newSourceResource} onChange={(e) => setNewSourceResource(e.target.value)} placeholder={t("wizard.ds_resource")} className="h-8 text-xs bg-background/50" />
            <Select value={newSourceMode} onValueChange={(v) => setNewSourceMode(v as "read" | "write")}>
              <SelectTrigger className="h-8 text-xs bg-background/50" aria-label="Select data source mode"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="read">{t("wizard.ds_mode_read")}</SelectItem>
                <SelectItem value="write">{t("wizard.ds_mode_write")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex gap-2">
            <Input value={newSourcePurpose} onChange={(e) => setNewSourcePurpose(e.target.value)} placeholder={t("wizard.ds_purpose")} className="h-8 text-xs bg-background/50 flex-1" />
            <Button variant="outline" size="sm" onClick={addDataSource} className="shrink-0 gap-1" disabled={!newSourceName.trim() || !newSourceConnector}>
              <Plus className="h-3.5 w-3.5" /> {t("wizard.add")}
            </Button>
          </div>
        </Card>
      ) : (
        <Card className="p-4 text-center bg-muted/10 border-dashed">
          <p className="text-xs text-muted-foreground">{t("wizard.ds_connect_first")}</p>
        </Card>
      )}

      {/* Field Mappings */}
      <div className="space-y-3">
        <Label className="flex items-center gap-1.5 text-sm font-medium">
          <Link2 className="h-3.5 w-3.5" /> {t("wizard.fm_title")}
        </Label>
        <p className="text-xs text-muted-foreground">{t("wizard.fm_desc")}</p>

        {data.field_mappings.length > 0 && (
          <div className="space-y-2">
            {data.field_mappings.map((fm) => {
              const ds = data.data_sources.find((d) => d.id === fm.data_source_id);
              return (
                <Card key={fm.id} className="p-3 bg-muted/20 flex items-center gap-2 flex-wrap">
                  <code className="text-xs font-mono text-primary bg-primary/10 px-1.5 py-0.5 rounded">{fm.bot_field}</code>
                  <ArrowRight className="h-3 w-3 text-muted-foreground shrink-0" />
                  <span className="text-xs text-foreground">{ds?.name || "?"}</span>
                  <span className="text-[10px] text-muted-foreground">→ {fm.external_field}</span>
                  <Select value={fm.transform} onValueChange={(v) => updateMapping(fm.id, { transform: v as FieldMapping["transform"] })}>
                    <SelectTrigger className="h-6 text-[10px] w-24 bg-background/50" aria-label="Select transform"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {TRANSFORM_OPTIONS.map((tr) => (
                        <SelectItem key={tr} value={tr}>{TRANSFORM_KEYS[tr] ? t(TRANSFORM_KEYS[tr] as any) : tr}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <div className="flex items-center gap-1">
                    <Checkbox checked={fm.required} onCheckedChange={(v) => updateMapping(fm.id, { required: !!v })} />
                    <span className="text-[10px] text-muted-foreground">{t("wizard.required")}</span>
                  </div>
                  <button onClick={() => removeMapping(fm.id)} className="text-muted-foreground hover:text-destructive ml-auto">
                    <X className="h-3.5 w-3.5" />
                  </button>
                </Card>
              );
            })}
          </div>
        )}

        {data.data_sources.length > 0 && (
          <div className="flex flex-wrap gap-2 items-center">
            <Input value={newMapBotField} onChange={(e) => setNewMapBotField(e.target.value)} placeholder={t("wizard.fm_bot_field")} className="h-8 text-xs bg-background/50 font-mono" />
            <ArrowRight className="h-4 w-4 text-muted-foreground" />
            <div className="flex gap-1">
              <Select value={newMapDsId} onValueChange={setNewMapDsId}>
                <SelectTrigger className="h-8 text-xs bg-background/50 w-28" aria-label="Select destination data source"><SelectValue placeholder={t("wizard.fm_dest")} /></SelectTrigger>
                <SelectContent>
                  {data.data_sources.map((ds) => (
                    <SelectItem key={ds.id} value={ds.id}>{ds.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input value={newMapExtField} onChange={(e) => setNewMapExtField(e.target.value)} placeholder={t("wizard.fm_ext_field")} className="h-8 text-xs bg-background/50" />
            </div>
            <Button variant="outline" size="sm" onClick={addMapping} className="shrink-0" disabled={!newMapBotField.trim() || !newMapDsId || !newMapExtField.trim()}>
              <Plus className="h-3.5 w-3.5" />
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
