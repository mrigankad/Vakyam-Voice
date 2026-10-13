import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type VoiceStatus = "idle" | "connecting" | "connected" | "speaking" | "listening" | "error";

interface UseVoiceAgentReturn {
  status: VoiceStatus;
  isSpeaking: boolean;
  error: string | null;
  startCall: () => Promise<void>;
  endCall: () => void;
}

/** Calls are cut off after this long so a forgotten tab cannot run up cost. */
const MAX_CALL_MS = 10 * 60 * 1000;

interface Call {
  peer: RTCPeerConnection;
  microphone: MediaStream;
  audio: HTMLAudioElement;
  timeout: number;
}

const getErrorMessage = (value: unknown): string => {
  if (value instanceof DOMException && value.name === "NotAllowedError") {
    return "Microphone access was blocked. Allow the microphone for this site and try again.";
  }
  if (value instanceof DOMException && value.name === "NotFoundError") {
    return "No microphone was found. Check your browser audio input settings.";
  }
  if (value instanceof DOMException && value.name === "NotReadableError") {
    return "The microphone is busy. Close other apps or tabs that are using it and try again.";
  }
  if (value instanceof Error && value.message) return value.message;
  return "The voice call could not be started. Please try again.";
};

export const useVoiceAgent = (): UseVoiceAgentReturn => {
  const [status, setStatus] = useState<VoiceStatus>("idle");
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const callRef = useRef<Call | null>(null);
  // Bumped on every start and stop, so a start that is still in flight can
  // tell it has been cancelled.
  const attemptRef = useRef(0);

  const teardown = useCallback(() => {
    attemptRef.current += 1;
    const call = callRef.current;
    callRef.current = null;
    if (!call) return;
    window.clearTimeout(call.timeout);
    call.microphone.getTracks().forEach((track) => track.stop());
    call.peer.close();
    call.audio.srcObject = null;
  }, []);

  useEffect(() => teardown, [teardown]);

  const endCall = useCallback(() => {
    teardown();
    setStatus("idle");
    setIsSpeaking(false);
  }, [teardown]);

  const startCall = useCallback(async () => {
    teardown();
    const attempt = attemptRef.current;
    setStatus("connecting");
    setError(null);

    let microphone: MediaStream | null = null;
    let peer: RTCPeerConnection | null = null;

    const fail = (cause: unknown) => {
      console.error("Voice call failed:", cause);
      microphone?.getTracks().forEach((track) => track.stop());
      peer?.close();
      if (attempt !== attemptRef.current) return;
      teardown();
      setError(getErrorMessage(cause));
      setStatus("error");
      setIsSpeaking(false);
    };

    try {
      // Ask for the microphone and the session token at the same time; they
      // are independent and together make up most of the connection wait.
      const [stream, session] = await Promise.all([
        navigator.mediaDevices.getUserMedia({
          audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
        }),
        supabase.functions.invoke("realtime-token"),
      ]);
      microphone = stream;

      const { data, error: tokenError } = session;
      if (tokenError || !data?.token || !data?.callUrl) {
        throw new Error(data?.error || tokenError?.message || "Failed to get a voice session");
      }
      if (attempt !== attemptRef.current) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }

      peer = new RTCPeerConnection();
      const connection = peer;
      const audio = new Audio();
      audio.autoplay = true;
      // Registered before negotiating, so ending the call at any point from
      // here on releases the microphone and the connection.
      callRef.current = {
        peer: connection,
        microphone: stream,
        audio,
        timeout: window.setTimeout(endCall, MAX_CALL_MS),
      };
      connection.ontrack = (event) => {
        audio.srcObject = event.streams[0];
      };
      stream.getAudioTracks().forEach((track) => connection.addTrack(track, stream));

      const events = connection.createDataChannel("realtime-channel");
      events.addEventListener("open", () => {
        // Meera speaks first, as on a phone line.
        events.send(
          JSON.stringify({
            type: "response.create",
            response: {
              instructions: `Open the call by saying exactly this, and nothing else: "${data.firstMessage}"`,
            },
          }),
        );
      });
      events.addEventListener("message", (message) => {
        if (attempt !== attemptRef.current) return;
        const { type } = JSON.parse(message.data) as { type?: string };
        if (type === "output_audio_buffer.started") {
          setIsSpeaking(true);
          setStatus("speaking");
        } else if (type === "output_audio_buffer.stopped" || type === "input_audio_buffer.speech_started") {
          setIsSpeaking(false);
          setStatus("listening");
        }
      });

      // The service closes the channel when it ends the session.
      events.addEventListener("close", () => {
        if (attempt === attemptRef.current) endCall();
      });

      connection.onconnectionstatechange = () => {
        if (attempt !== attemptRef.current) return;
        if (connection.connectionState === "connected") {
          setStatus((current) => (current === "connecting" ? "connected" : current));
        } else if (connection.connectionState === "failed") {
          fail(new Error("The voice connection was lost. Please try again."));
        }
      };

      const offer = await connection.createOffer();
      await connection.setLocalDescription(offer);
      const answer = await fetch(data.callUrl, {
        method: "POST",
        body: offer.sdp,
        headers: { Authorization: `Bearer ${data.token}`, "Content-Type": "application/sdp" },
      });
      if (attempt !== attemptRef.current) return;
      if (!answer.ok) throw new Error(`The voice service refused the call (${answer.status}).`);
      const sdp = await answer.text();
      if (attempt !== attemptRef.current) return;
      await connection.setRemoteDescription({ type: "answer", sdp });
    } catch (cause: unknown) {
      fail(cause);
    }
  }, [teardown, endCall]);

  return { status, isSpeaking, error, startCall, endCall };
};
