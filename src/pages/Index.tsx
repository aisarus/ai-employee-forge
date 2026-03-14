import { supabase } from "../lib/supabase";
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
    

// // Mock logic removed

  // Fetch real API
  const callApi = async () => {
    try {
      const response = await fetch("https://bbhypbkanbquuoptbugo.supabase.co/functions/v1/tri-tfm-controller", {
        method: "POST",
        headers: {
          "Authorization": "Bearer tri_test_master_123",
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          prompt: `Convert the following business description into a strict, production-ready System Prompt for an AI support agent. Use clear headings like "Role", "Core Tasks", "Constraints", and "Output Format".\n\nBusiness description: ${prompt}`,
          apiProvider: "openai",
          customApiKey: "sk-proj-FAKE_FOR_NOW",
          config: {
            maxIterations: 5,
            useProposerCriticVerifier: true,
            proposerCriticOnly: true
          }
        })
      });

      const data = await response.json();
      
      // Save to Supabase DB
      await supabase.from("agents").insert({
        name: "AutoBot",
        description: prompt,
        system_prompt: data.finalText || "Error generating prompt"
      });

      // Pass to workspace (we will use localStorage for quick hack, or global state)
      localStorage.setItem("generatedPrompt", data.finalText || "");
      setState("workspace");
    } catch (e) {
      console.error(e);
      setState("workspace"); // fallback
    }
  };
  callApi();
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
