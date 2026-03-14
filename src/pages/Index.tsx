import { useState, useEffect, useCallback } from "react";
import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { GnomeAssembly } from "@/components/GnomeAssembly";
import { Workspace } from "@/components/Workspace";

type WorkflowState = "input" | "loading" | "workspace";

const Index = () => {
  const [state, setState] = useState<WorkflowState>("input");
  const [prompt, setPrompt] = useState("");

  const handleGenerate = useCallback(() => {
    if (!prompt.trim()) return;
    setState("loading");
  }, [prompt]);

  useEffect(() => {
    if (state !== "loading") return;
    const timer = setTimeout(() => setState("workspace"), 4000);
    return () => clearTimeout(timer);
  }, [state]);

  if (state === "loading") {
    return (
      <div className="flex flex-1 items-center justify-center">
        <GnomeAssembly />
      </div>
    );
  }

  if (state === "workspace") {
    return <Workspace />;
  }

  return (
    <div className="flex flex-1 items-center justify-center p-6">
      <div className="w-full max-w-2xl space-y-8 animate-fade-in">
        <div className="space-y-3 text-center">
          <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            Hire your next AI Employee
          </h1>
          <p className="text-muted-foreground text-base max-w-lg mx-auto leading-relaxed">
            Describe your business in plain English, we do the prompt engineering.
          </p>
        </div>

        <div className="space-y-4">
          <Textarea
            rows={6}
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="e.g., I sell flowers. Delivery is $5. If roses are out of stock, offer tulips. Ask for address and phone number."
            className="resize-none bg-card/50 backdrop-blur-sm text-sm leading-relaxed"
          />
          <Button
            onClick={handleGenerate}
            disabled={!prompt.trim()}
            size="lg"
            className="w-full gap-2"
          >
            <Sparkles className="h-4 w-4" />
            Generate AI Brain
          </Button>
        </div>
      </div>
    </div>
  );
};

export default Index;
