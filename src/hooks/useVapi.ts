import { useCallback, useEffect, useRef, useState } from "react";
import Vapi from "@vapi-ai/web";
import { supabase } from "@/integrations/supabase/client";

export type VapiStatus = "idle" | "connecting" | "connected" | "speaking" | "listening" | "error";

interface UseVapiReturn {
  status: VapiStatus;
  isSpeaking: boolean;
  transcript: string;
  detectedLanguage: string | null;
  error: string | null;
  startCall: () => Promise<void>;
  endCall: () => void;
}

const getErrorMessage = (value: unknown): string => {
  if (value instanceof Error) return value.message;
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    if (typeof record.message === "string") return record.message;
    if (record.error && typeof record.error === "object") {
      const nested = record.error as Record<string, unknown>;
      if (typeof nested.message === "string") return nested.message;
    }
  }
  return "The voice call could not be started. Please try again.";
};

export const useVapi = (): UseVapiReturn => {
  const [status, setStatus] = useState<VapiStatus>("idle");
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [detectedLanguage, setDetectedLanguage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const vapiRef = useRef<Vapi | null>(null);

  useEffect(() => () => vapiRef.current?.stop(), []);

  const startCall = useCallback(async () => {
    try {
      setStatus("connecting");
      setError(null);
      setTranscript("");
      setDetectedLanguage(null);

      // Verify microphone access, then release this preflight stream before
      // Vapi/Daily acquires the device for the actual call. Keeping this first
      // stream open can leave the call connected with no customer audio.
      const permissionStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      const microphoneTrack = permissionStream.getAudioTracks()[0];
      if (!microphoneTrack || microphoneTrack.readyState !== "live") {
        permissionStream.getTracks().forEach((track) => track.stop());
        throw new Error("No active microphone was found. Check your browser audio input settings.");
      }
      permissionStream.getTracks().forEach((track) => track.stop());

      const { data, error: fetchError } = await supabase.functions.invoke("vapi-web-token");
      if (fetchError || !data?.assistantId || !data?.token) {
        throw new Error(fetchError?.message || data?.error || "Failed to get assistant configuration");
      }

      const vapi = new Vapi(data.token);
      vapiRef.current = vapi;
      vapi.on("call-start", () => setStatus("connected"));
      vapi.on("call-end", () => {
        setStatus("idle");
        setIsSpeaking(false);
        vapiRef.current = null;
      });
      vapi.on("speech-start", () => {
        setIsSpeaking(true);
        setStatus("speaking");
      });
      vapi.on("speech-end", () => {
        setIsSpeaking(false);
        setStatus("listening");
      });
      vapi.on("message", (message: Record<string, unknown>) => {
        if (message.type === "transcript" && typeof message.transcript === "string") {
          setTranscript((previous) => `${previous} ${message.transcript}`.trim());
        }
        const language = message.language || message.detectedLanguage;
        if (typeof language === "string") setDetectedLanguage(language);
      });
      vapi.on("error", (event: unknown) => {
        console.error("Vapi error:", event);
        setError(getErrorMessage(event));
        setStatus("error");
      });

      // Preserve the saved Club Mahindra prompt, nova-3 bilingual
      // transcriber, and Naina voice without browser-side overrides.
      await vapi.start(data.assistantId);
    } catch (event: unknown) {
      console.error("Failed to start Vapi call:", event);
      setError(getErrorMessage(event));
      setStatus("error");
    }
  }, []);

  const endCall = useCallback(() => {
    vapiRef.current?.stop();
    vapiRef.current = null;
    setStatus("idle");
    setIsSpeaking(false);
  }, []);

  return { status, isSpeaking, transcript, detectedLanguage, error, startCall, endCall };
};
