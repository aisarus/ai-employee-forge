import { WizardData } from "./types";
import { TelegramProfileMockup, TelegramChatMockup, TelegramStartMockup } from "./TelegramMockup";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { User, MessageCircle, Play } from "lucide-react";

interface Props {
  data: WizardData;
}

export function StepTelegramPreview({ data }: Props) {
  return (
    <div className="space-y-6 animate-fade-in">
      <div className="text-center space-y-1">
        <h2 className="text-xl font-bold text-foreground">Telegram Preview</h2>
        <p className="text-sm text-muted-foreground">See how your bot will look and feel in Telegram.</p>
      </div>

      <Tabs defaultValue="chat" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="profile" className="gap-1.5 text-xs"><User className="h-3.5 w-3.5" /> Profile</TabsTrigger>
          <TabsTrigger value="chat" className="gap-1.5 text-xs"><MessageCircle className="h-3.5 w-3.5" /> Chat</TabsTrigger>
          <TabsTrigger value="start" className="gap-1.5 text-xs"><Play className="h-3.5 w-3.5" /> Start</TabsTrigger>
        </TabsList>
        <TabsContent value="profile" className="pt-4">
          <TelegramProfileMockup data={data} />
        </TabsContent>
        <TabsContent value="chat" className="pt-4">
          <TelegramChatMockup data={data} />
        </TabsContent>
        <TabsContent value="start" className="pt-4">
          <TelegramStartMockup data={data} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
