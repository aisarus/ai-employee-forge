import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AvatarUpload } from "./AvatarUpload";
import { WizardData, LANGUAGES, TONES, RESPONSE_STYLES } from "./types";
import { Bot, AtSign, Globe, MessageCircle, Palette } from "lucide-react";

interface Props {
  data: WizardData;
  onChange: (patch: Partial<WizardData>) => void;
  onAvatarUpload: (file: File) => void;
  onAvatarRemove: () => void;
}

export function StepIdentity({ data, onChange, onAvatarUpload, onAvatarRemove }: Props) {
  return (
    <div className="space-y-6 animate-fade-in">
      <div className="text-center space-y-1">
        <h2 className="text-xl font-bold text-foreground">Define Your Bot's Identity</h2>
        <p className="text-sm text-muted-foreground">Set the name, appearance, and personality of your bot.</p>
      </div>

      <AvatarUpload
        avatarUrl={data.bot_avatar_url}
        name={data.bot_name}
        onUpload={onAvatarUpload}
        onRemove={onAvatarRemove}
      />

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label className="flex items-center gap-1.5 text-sm"><Bot className="h-3.5 w-3.5" /> Bot Name *</Label>
          <Input
            value={data.bot_name}
            onChange={(e) => onChange({ bot_name: e.target.value })}
            placeholder="Flora Assistant"
            className="bg-background/50"
          />
        </div>
        <div className="space-y-2">
          <Label className="flex items-center gap-1.5 text-sm"><AtSign className="h-3.5 w-3.5" /> Username Hint</Label>
          <Input
            value={data.bot_username_hint}
            onChange={(e) => onChange({ bot_username_hint: e.target.value })}
            placeholder="flora_support_bot"
            className="bg-background/50"
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label className="text-sm">Short Description *</Label>
        <Textarea
          value={data.short_description}
          onChange={(e) => onChange({ short_description: e.target.value })}
          placeholder="Describe what this bot does in one short sentence."
          rows={2}
          className="bg-background/50 resize-none"
        />
      </div>

      <div className="space-y-2">
        <Label className="text-sm">About / Bio</Label>
        <Textarea
          value={data.about_text}
          onChange={(e) => onChange({ about_text: e.target.value })}
          placeholder="Optional Telegram-style about text."
          rows={2}
          className="bg-background/50 resize-none"
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="space-y-2">
          <Label className="flex items-center gap-1.5 text-sm"><Globe className="h-3.5 w-3.5" /> Language *</Label>
          <Select value={data.default_language} onValueChange={(v) => onChange({ default_language: v })}>
            <SelectTrigger className="bg-background/50"><SelectValue /></SelectTrigger>
            <SelectContent>
              {LANGUAGES.map((l) => <SelectItem key={l} value={l}>{l}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label className="flex items-center gap-1.5 text-sm"><Palette className="h-3.5 w-3.5" /> Tone *</Label>
          <Select value={data.tone} onValueChange={(v) => onChange({ tone: v })}>
            <SelectTrigger className="bg-background/50"><SelectValue /></SelectTrigger>
            <SelectContent>
              {TONES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label className="flex items-center gap-1.5 text-sm"><MessageCircle className="h-3.5 w-3.5" /> Style *</Label>
          <Select value={data.response_style} onValueChange={(v) => onChange({ response_style: v })}>
            <SelectTrigger className="bg-background/50"><SelectValue /></SelectTrigger>
            <SelectContent>
              {RESPONSE_STYLES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  );
}
