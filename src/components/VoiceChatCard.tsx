import { Languages, Loader2, Mic, MicOff } from "lucide-react";
import { useVapi } from "@/hooks/useVapi";
import { useToast } from "@/hooks/use-toast";
import { useEffect } from "react";

const LANGUAGE_LABEL: Record<string, string> = {
  en: "English",
  hi: "Hindi",
  multi: "Hindi / English",
};

export const VoiceChatCard = () => {
  const { status, isSpeaking, error, detectedLanguage, startCall, endCall } = useVapi();
  const { toast } = useToast();

  useEffect(() => {
    if (error) {
      toast({ variant: "destructive", title: "Voice Chat Error", description: error });
    }
  }, [error, toast]);

  const handleMicClick = async () => {
    if (status === "idle" || status === "error") await startCall();
    else endCall();
  };

  const stateText = {
    connecting: "Connecting securely...",
    connected: "Connected",
    listening: "Listening...",
    speaking: "Meera is speaking...",
    error: "Click to retry",
    idle: "Click to start speaking",
  }[status];
  const isActive = status !== "idle" && status !== "error";
  const detectedLabel = detectedLanguage
    ? LANGUAGE_LABEL[detectedLanguage] || detectedLanguage.toUpperCase()
    : null;

  return (
    <div className="card-elevated flex flex-col items-center p-6 text-center">
      <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-wayam">
        Live member care
      </p>
      <h3 className="font-display text-display-sm text-foreground">Talk to Meera</h3>
      <p className="mb-4 mt-1 text-sm text-muted-foreground">
        Club Mahindra bilingual member concierge
      </p>

      <div className="mb-5 flex items-center gap-2 rounded-full border border-border bg-muted/40 px-3 py-1.5 text-xs text-muted-foreground">
        <Languages className="h-4 w-4 text-wayam" />
        Speak naturally in Hindi or English
      </div>

      <button
        onClick={handleMicClick}
        disabled={status === "connecting"}
        className={`voice-orb mb-5 h-24 w-24 ${isActive ? "listening" : ""} ${isSpeaking ? "speaking" : ""} disabled:cursor-not-allowed disabled:opacity-50`}
        aria-label={isActive ? "End voice chat" : "Start voice chat"}
      >
        {status === "connecting" ? (
          <Loader2 className="h-8 w-8 animate-spin text-primary-foreground" />
        ) : isActive ? (
          <MicOff className="h-8 w-8 text-primary-foreground" />
        ) : (
          <Mic className="h-8 w-8 text-primary-foreground" />
        )}
      </button>

      <p className="text-sm font-medium text-foreground">Club Mahindra Member Care</p>
      <p className="text-xs text-muted-foreground">{stateText}</p>
      {isActive && detectedLabel && (
        <p className="mt-1 text-xs text-muted-foreground">
          Detected: <span className="font-medium text-foreground">{detectedLabel}</span>
        </p>
      )}
    </div>
  );
};

