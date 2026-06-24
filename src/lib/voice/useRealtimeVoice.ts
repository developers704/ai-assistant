"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { VoiceUiAction } from "@/lib/voice/execute-tool";
import { VOICE_MAX_TURNS, VOICE_SESSION_MAX_MS } from "@/lib/voice/config";
import { detectVoiceIntent, normalizeVoiceTranscript } from "@/lib/voice/intent";

export type RealtimeVoiceStatus =
  | "idle"
  | "connecting"
  | "ready"
  | "listening"
  | "thinking"
  | "speaking"
  | "error";

interface RealtimeServerEvent {
  type: string;
  transcript?: string;
  delta?: string;
  name?: string;
  call_id?: string;
  arguments?: string;
  error?: { message?: string };
}

function sendEvent(dc: RTCDataChannel, event: Record<string, unknown>) {
  if (dc.readyState === "open") {
    dc.send(JSON.stringify(event));
  }
}

export function useRealtimeVoice(enabled: boolean) {
  const router = useRouter();
  const [status, setStatus] = useState<RealtimeVoiceStatus>("idle");
  const [sessionActive, setSessionActive] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [userTranscript, setUserTranscript] = useState("");
  const [assistantTranscript, setAssistantTranscript] = useState("");
  const [supported, setSupported] = useState(true);

  const pcRef = useRef<RTCPeerConnection | null>(null);
  const dcRef = useRef<RTCDataChannel | null>(null);
  const micStreamRef = useRef<MediaStream | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const sessionStartRef = useRef<number | null>(null);
  const turnCountRef = useRef(0);
  const sessionActiveRef = useRef(false);
  const processingToolRef = useRef(false);
  const processingResponseRef = useRef(false);
  const pendingResponseRef = useRef(false);
  const responseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastTranscriptRef = useRef("");

  const clearResponseTimer = useCallback(() => {
    if (responseTimerRef.current) {
      clearTimeout(responseTimerRef.current);
      responseTimerRef.current = null;
    }
  }, []);

  const enableMic = useCallback(() => {
    const track = micStreamRef.current?.getAudioTracks()[0];
    if (track) track.enabled = true;
  }, []);

  const disableMic = useCallback(() => {
    const track = micStreamRef.current?.getAudioTracks()[0];
    if (track) track.enabled = false;
  }, []);

  const applyUiAction = useCallback(
    (action?: VoiceUiAction) => {
      if (action?.type === "navigate" && action.path) {
        router.push(action.path);
      }
    },
    [router]
  );

  const createResponse = useCallback(
    async (transcript: string) => {
      if (!sessionActiveRef.current || processingResponseRef.current) return;
      pendingResponseRef.current = false;
      clearResponseTimer();
      processingResponseRef.current = true;

      const dc = dcRef.current;
      if (!dc) {
        processingResponseRef.current = false;
        return;
      }

      const normalized = normalizeVoiceTranscript(transcript);
      const intent = detectVoiceIntent(normalized);

      if (intent === "email_draft") {
        try {
          const res = await fetch("/api/voice/email-draft", { method: "POST" });
          const data = await res.json();
          if (data.navigateTo) {
            applyUiAction({ type: "navigate", path: data.navigateTo });
          }
          const script = String(data.script ?? "");
          setAssistantTranscript(script);
          setStatus("thinking");
          sendEvent(dc, {
            type: "response.create",
            response: {
              instructions: `The user asked to DRAFT AN EMAIL REPLY. Say exactly this and nothing else — do not set reminders or mention calendar:\n\n${script}`,
              max_output_tokens: 280,
            },
          });
          return;
        } catch {
          // fall through to next intent
        }
      }

      if (intent === "email") {
        try {
          const res = await fetch("/api/voice/email-answer");
          const data = await res.json();
          applyUiAction(data.uiAction as VoiceUiAction | undefined);
          const script = String(data.script ?? "");
          setAssistantTranscript(script);
          setStatus("thinking");
          sendEvent(dc, {
            type: "response.create",
            response: {
              instructions: `The user asked about EMAIL. Say exactly this inbox summary and nothing else — do not mention calendar or meetings:\n\n${script}`,
              max_output_tokens: 250,
            },
          });
          return;
        } catch {
          // fall through
        }
      }

      if (intent === "calendar") {
        try {
          const res = await fetch("/api/voice/calendar-answer");
          const data = await res.json();
          applyUiAction(data.uiAction as VoiceUiAction | undefined);
          const script = String(data.script ?? "");
          setAssistantTranscript(script);
          setStatus("thinking");
          sendEvent(dc, {
            type: "response.create",
            response: {
              instructions: `The user asked about CALENDAR. Say exactly this and nothing else — do not mention emails:\n\n${script}`,
              max_output_tokens: 200,
            },
          });
          return;
        } catch {
          // fall through
        }
      }

      if (intent === "sales") {
        try {
          const res = await fetch("/api/voice/tools", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ name: "get_today_sales", arguments: {} }),
          });
          const data = await res.json();
          applyUiAction(data.uiAction as VoiceUiAction | undefined);
          const parsed = JSON.parse(String(data.output ?? "{}")) as {
            totalRevenue?: number;
            totalTransactions?: number;
          };
          const script = `Today's sales are $${(parsed.totalRevenue ?? 0).toLocaleString()} across ${parsed.totalTransactions ?? 0} transactions.`;
          setAssistantTranscript(script);
          setStatus("thinking");
          sendEvent(dc, {
            type: "response.create",
            response: {
              instructions: `Say exactly this and nothing else:\n\n${script}`,
              max_output_tokens: 150,
            },
          });
          return;
        } catch {
          // fall through
        }
      }

      setStatus("thinking");
      sendEvent(dc, {
        type: "response.create",
        response: {
          instructions:
            "Answer only what the user asked. If unclear, ask them to repeat. Do not invent reminders, calendar events, or tasks unless they explicitly asked.",
          max_output_tokens: 200,
        },
      });
    },
    [applyUiAction, clearResponseTimer]
  );

  const scheduleResponse = useCallback(() => {
    clearResponseTimer();
    responseTimerRef.current = setTimeout(() => {
      if (pendingResponseRef.current && lastTranscriptRef.current) {
        void createResponse(lastTranscriptRef.current);
      } else if (pendingResponseRef.current && sessionActiveRef.current) {
        pendingResponseRef.current = false;
        processingResponseRef.current = false;
        setStatus("listening");
      }
    }, 8000);
  }, [clearResponseTimer, createResponse]);

  const teardownConnection = useCallback(() => {
    clearResponseTimer();
    pendingResponseRef.current = false;
    processingResponseRef.current = false;
    dcRef.current?.close();
    dcRef.current = null;
    pcRef.current?.close();
    pcRef.current = null;
    disableMic();
    micStreamRef.current?.getTracks().forEach((t) => t.stop());
    micStreamRef.current = null;
    if (audioRef.current) {
      audioRef.current.srcObject = null;
    }
    sessionStartRef.current = null;
    turnCountRef.current = 0;
    processingToolRef.current = false;
  }, [clearResponseTimer, disableMic]);

  const disconnect = useCallback(() => {
    sessionActiveRef.current = false;
    setSessionActive(false);
    teardownConnection();
    setStatus("idle");
    setUserTranscript("");
    setAssistantTranscript("");
    setError(null);
  }, [teardownConnection]);

  const endSessionWithError = useCallback(
    (message: string) => {
      sessionActiveRef.current = false;
      setSessionActive(false);
      teardownConnection();
      setUserTranscript("");
      setAssistantTranscript("");
      setError(message);
      setStatus("error");
    },
    [teardownConnection]
  );

  const closePanel = useCallback(() => {
    disconnect();
  }, [disconnect]);

  const handleFunctionCall = useCallback(
    async (name: string, callId: string, argsJson: string) => {
      const dc = dcRef.current;
      if (!dc || processingToolRef.current) return;
      processingToolRef.current = true;
      setStatus("thinking");

      try {
        const res = await fetch("/api/voice/tools", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name, arguments: argsJson, callId }),
        });
        const data = await res.json();
        applyUiAction(data.uiAction as VoiceUiAction | undefined);

        sendEvent(dc, {
          type: "conversation.item.create",
          item: {
            type: "function_call_output",
            call_id: callId,
            output: String(data.output ?? "{}"),
          },
        });
        sendEvent(dc, { type: "response.create" });
      } catch {
        sendEvent(dc, {
          type: "conversation.item.create",
          item: {
            type: "function_call_output",
            call_id: callId,
            output: JSON.stringify({ error: "Tool failed" }),
          },
        });
        sendEvent(dc, { type: "response.create" });
      } finally {
        processingToolRef.current = false;
      }
    },
    [applyUiAction]
  );

  const handleServerEvent = useCallback(
    (event: RealtimeServerEvent) => {
      switch (event.type) {
        case "session.created":
        case "session.updated":
          if (sessionActiveRef.current) setStatus("listening");
          break;
        case "input_audio_buffer.speech_started":
          if (sessionActiveRef.current) {
            setUserTranscript("");
            setAssistantTranscript("");
            setStatus("listening");
          }
          break;
        case "input_audio_buffer.speech_stopped":
          if (sessionActiveRef.current) {
            setStatus("thinking");
            pendingResponseRef.current = true;
            scheduleResponse();
          }
          break;
        case "conversation.item.input_audio_transcription.completed":
          if (event.transcript && sessionActiveRef.current) {
            const normalized = normalizeVoiceTranscript(event.transcript);
            setUserTranscript(normalized);
            lastTranscriptRef.current = normalized;
            void createResponse(normalized);
          }
          break;
        case "response.output_audio_transcript.delta":
          if (event.delta) {
            setAssistantTranscript((prev) => prev + event.delta);
            setStatus("speaking");
          }
          break;
        case "response.output_audio_transcript.done":
          if (event.transcript) setAssistantTranscript(event.transcript);
          setStatus("speaking");
          break;
        case "response.function_call_arguments.done":
          if (event.name && event.call_id && event.arguments !== undefined) {
            void handleFunctionCall(event.name, event.call_id, event.arguments);
          }
          break;
        case "response.done":
          turnCountRef.current += 1;
          processingResponseRef.current = false;
          if (turnCountRef.current >= VOICE_MAX_TURNS) {
            endSessionWithError("Session limit reached. Tap mic to start again.");
          } else if (sessionActiveRef.current) {
            enableMic();
            setStatus("listening");
          }
          break;
        case "error": {
          const msg = event.error?.message ?? "Voice session error";
          processingResponseRef.current = false;
          setError(msg);
          setStatus("error");
          break;
        }
        default:
          break;
      }
    },
    [createResponse, enableMic, endSessionWithError, handleFunctionCall, scheduleResponse]
  );

  const connect = useCallback(async () => {
    if (pcRef.current || !enabled) return;
    setError(null);
    setStatus("connecting");

    try {
      const sessionRes = await fetch("/api/voice/session", { method: "POST" });
      const sessionData = await sessionRes.json();
      if (!sessionRes.ok) {
        throw new Error(sessionData.error ?? "Could not start voice session");
      }

      const pc = new RTCPeerConnection();
      pcRef.current = pc;

      const mic = await navigator.mediaDevices.getUserMedia({ audio: true });
      micStreamRef.current = mic;
      const track = mic.getAudioTracks()[0];
      track.enabled = false;
      pc.addTrack(track, mic);

      if (!audioRef.current) {
        audioRef.current = new Audio();
        audioRef.current.autoplay = true;
      }
      pc.ontrack = (e) => {
        if (audioRef.current) {
          audioRef.current.srcObject = e.streams[0] ?? null;
        }
      };

      const dc = pc.createDataChannel("oai-events");
      dcRef.current = dc;
      dc.onmessage = (msg) => {
        try {
          handleServerEvent(JSON.parse(msg.data) as RealtimeServerEvent);
        } catch {
          // ignore malformed events
        }
      };

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      const sdpRes = await fetch("https://api.openai.com/v1/realtime/calls", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${sessionData.clientSecret}`,
          "Content-Type": "application/sdp",
        },
        body: offer.sdp,
      });

      if (!sdpRes.ok) {
        const errText = await sdpRes.text();
        let friendly = errText || "WebRTC connection failed";
        try {
          const parsed = JSON.parse(errText) as { error?: { message?: string } };
          if (parsed.error?.message) friendly = parsed.error.message;
        } catch {
          // keep raw text
        }
        throw new Error(friendly);
      }

      const answerSdp = await sdpRes.text();
      await pc.setRemoteDescription({ type: "answer", sdp: answerSdp });

      sessionStartRef.current = Date.now();
      if (sessionActiveRef.current) {
        enableMic();
        setStatus("listening");
      } else {
        setStatus("ready");
      }
    } catch (err) {
      endSessionWithError(err instanceof Error ? err.message : "Failed to connect");
    }
  }, [enabled, enableMic, endSessionWithError, handleServerEvent]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const ok =
      !!window.RTCPeerConnection &&
      !!navigator.mediaDevices?.getUserMedia;
    setSupported(ok);
  }, []);

  useEffect(() => {
    if (!sessionStartRef.current) return;
    const timer = setInterval(() => {
      if (
        sessionStartRef.current &&
        Date.now() - sessionStartRef.current > VOICE_SESSION_MAX_MS
      ) {
        endSessionWithError("Session timed out (5 min). Tap mic to start again.");
      }
    }, 5000);
    return () => clearInterval(timer);
  }, [endSessionWithError, status]);

  useEffect(() => {
    return () => disconnect();
  }, [disconnect]);

  const startSession = useCallback(async () => {
    if (!enabled || sessionActiveRef.current) return;
    sessionActiveRef.current = true;
    setSessionActive(true);
    setError(null);
    setUserTranscript("");
    setAssistantTranscript("");

    if (!pcRef.current) {
      await connect();
    } else {
      enableMic();
      setStatus("listening");
    }
  }, [connect, enableMic, enabled]);

  return {
    status,
    sessionActive,
    error,
    supported,
    userTranscript,
    assistantTranscript,
    startSession,
    closePanel,
  };
};
