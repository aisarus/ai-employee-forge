import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Workspace } from "@/components/Workspace";

/**
 * Stable route for the Workspace view.
 * Redirects to "/" if there's no generated prompt in localStorage.
 */
export default function WorkspacePage() {
  const navigate = useNavigate();

  useEffect(() => {
    const hasPrompt = !!localStorage.getItem("generatedPrompt");
    if (!hasPrompt) {
      navigate("/", { replace: true });
    }
  }, [navigate]);

  return <Workspace />;
}
