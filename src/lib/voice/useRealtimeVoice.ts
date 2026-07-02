"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { VoiceUiAction } from "@/lib/voice/types";
import { VOICE_MAX_TURNS, VOICE_SESSION_MAX_MS } from "@/lib/voice/constants";
import { detectVoiceIntent, extractCompleteTaskQuery, extractContactQuery, extractImagePrompt, extractPriceEstimate, extractTaskQuery, normalizeVoiceTranscript } from "@/lib/voice/intent";
import { isConfirmMessage, isRejectMessage } from "@/lib/actions/confirmation-messages";

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

const STOP_INSTRUCTION =
  "Say ONLY the text below, then stop. Do NOT ask follow-up questions. Do NOT offer to read emails, set reminders, or take any other action. Wait for the user to speak again.";

function isUsableTranscript(text: string): boolean {
  const t = text.trim();
  return t.length >= 3 && !/^(uh+|um+|hmm+|ok+|yeah+)$/i.test(t);
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
      if (!isUsableTranscript(transcript)) {
        processingResponseRef.current = false;
        pendingResponseRef.current = false;
        setStatus("listening");
        return;
      }
      pendingResponseRef.current = false;
      clearResponseTimer();
      processingResponseRef.current = true;

      const dc = dcRef.current;
      if (!dc) {
        processingResponseRef.current = false;
        return;
      }

      sendEvent(dc, { type: "response.cancel" });

      const normalized = normalizeVoiceTranscript(transcript);

      if (isConfirmMessage(normalized) || isRejectMessage(normalized)) {
        try {
          const res = await fetch("/api/voice/confirm", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action: isRejectMessage(normalized) ? "reject" : "confirm" }),
          });
          const data = await res.json();
          const script = String(data.spokenAnswer ?? data.script ?? "Done.");
          if (data.navigateTo) {
            applyUiAction({ type: "navigate", path: String(data.navigateTo) });
          }
          setAssistantTranscript(script);
          setStatus("thinking");
          disableMic();
          sendEvent(dc, {
            type: "response.create",
            response: {
              instructions: `${STOP_INSTRUCTION}\n\n${script}`,
              max_output_tokens: 200,
            },
          });
          return;
        } catch {
          // fall through
        }
      }

      const intent = detectVoiceIntent(normalized);

      const runTool = async (
        name: string,
        args: Record<string, unknown>,
        instructionPrefix: string,
        maxTokens = 250
      ) => {
        const res = await fetch("/api/voice/tools", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name, arguments: args }),
        });
        const data = await res.json();
        applyUiAction(data.uiAction as VoiceUiAction | undefined);
        const parsed = JSON.parse(String(data.output ?? "{}")) as {
          spokenAnswer?: string;
          script?: string;
        };
        const script = parsed.spokenAnswer ?? parsed.script ?? "Done.";
        setAssistantTranscript(script);
        setStatus("thinking");
        disableMic();
        sendEvent(dc, {
          type: "response.create",
          response: {
            instructions: `${instructionPrefix}\n\n${STOP_INSTRUCTION}\n\n${script}`,
            max_output_tokens: maxTokens,
          },
        });
      };

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
          disableMic();
          sendEvent(dc, {
            type: "response.create",
            response: {
              instructions: `The user asked to DRAFT AN EMAIL REPLY.\n\n${STOP_INSTRUCTION}\n\n${script}`,
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
          disableMic();
          sendEvent(dc, {
            type: "response.create",
            response: {
              instructions: `The user asked about EMAIL.\n\n${STOP_INSTRUCTION}\n\n${script}`,
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
          disableMic();
          sendEvent(dc, {
            type: "response.create",
            response: {
              instructions: `The user asked about CALENDAR.\n\n${STOP_INSTRUCTION}\n\n${script}`,
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
          await runTool(
            "get_today_sales",
            {},
            "The user asked about SALES. Say exactly this:",
            150
          );
          return;
        } catch {
          // fall through
        }
      }

      if (intent === "task_list") {
        try {
          await runTool("list_tasks", {}, "The user asked about TASKS. Say exactly this:");
          return;
        } catch {
          // fall through
        }
      }

      if (intent === "task_remove") {
        const title = extractTaskQuery(normalized);
        if (title) {
          try {
            await runTool(
              "delete_task",
              { title },
              "The user asked to REMOVE A TASK. Say exactly this:"
            );
            return;
          } catch {
            // fall through
          }
        }
      }

      if (intent === "task_complete") {
        const title = extractCompleteTaskQuery(normalized);
        if (title) {
          try {
            await runTool(
              "complete_task",
              { title },
              "The user asked to COMPLETE A TASK. Say exactly this:"
            );
            return;
          } catch {
            // fall through
          }
        }
      }

      if (intent === "contacts") {
        try {
          const query = extractContactQuery(normalized);
          await runTool(
            "list_contacts",
            query ? { query } : {},
            "The user asked about CONTACTS. Say exactly this:"
          );
          return;
        } catch {
          // fall through
        }
      }

      if (intent === "daily_briefing") {
        try {
          await runTool("get_daily_briefing", {}, "The user asked for a DAILY BRIEFING. Say exactly this:", 320);
          return;
        } catch {
          // fall through
        }
      }

      if (intent === "sports_news") {
        try {
          await runTool("get_sports_news", {}, "The user asked for SPORTS NEWS. Say exactly this:", 280);
          return;
        } catch {
          // fall through
        }
      }

      if (intent === "politics_news") {
        try {
          await runTool("get_politics_news", {}, "The user asked for POLITICS NEWS. Say exactly this:", 300);
          return;
        } catch {
          // fall through
        }
      }

      if (intent === "news") {
        try {
          await runTool("get_industry_news", {}, "The user asked for NEWS. Say exactly this:", 280);
          return;
        } catch {
          // fall through
        }
      }

      if (intent === "metal_rates") {
        try {
          await runTool("get_metal_rates", {}, "The user asked about METAL PRICES. Say exactly this:");
          return;
        } catch {
          // fall through
        }
      }

      if (intent === "price_estimate") {
        const est = extractPriceEstimate(normalized);
        if (est) {
          try {
            await runTool(
              "estimate_jewellery_price",
              { weight_grams: est.weight, karat: est.karat ?? "22K" },
              "The user asked for a PRICE ESTIMATE. Say exactly this:"
            );
            return;
          } catch {
            // fall through
          }
        }
      }

      if (intent === "image_generate") {
        const prompt = extractImagePrompt(normalized) ?? normalized;
        try {
          await runTool(
            "generate_jewellery_image",
            { prompt },
            "The user asked to GENERATE AN IMAGE. Say exactly this:",
            200
          );
          return;
        } catch {
          // fall through
        }
      }

      if (intent === "analyst") {
        try {
          await runTool("open_data_analyst", {}, "The user asked about DATA ANALYST. Say exactly this:");
          return;
        } catch {
          // fall through
        }
      }

      setStatus("thinking");
      disableMic();
      sendEvent(dc, {
        type: "response.create",
        response: {
          instructions: `${STOP_INSTRUCTION}\n\nUse ONE appropriate tool for what the user asked. After speaking the result, stop. Never ask follow-up questions or take extra actions while the user is silent.`,
          max_output_tokens: 220,
        },
      });
    },
    [applyUiAction, clearResponseTimer, disableMic]
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
      disableMic();

      try {
        const res = await fetch("/api/voice/tools", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name, arguments: argsJson, callId }),
        });
        const data = await res.json();
        applyUiAction(data.uiAction as VoiceUiAction | undefined);

        const parsed = JSON.parse(String(data.output ?? "{}")) as {
          spokenAnswer?: string;
          script?: string;
        };
        const script = parsed.spokenAnswer ?? parsed.script ?? "Done.";

        sendEvent(dc, {
          type: "conversation.item.create",
          item: {
            type: "function_call_output",
            call_id: callId,
            output: String(data.output ?? "{}"),
          },
        });
        sendEvent(dc, {
          type: "response.create",
          response: {
            instructions: `${STOP_INSTRUCTION}\n\n${script}`,
            max_output_tokens: 220,
          },
        });
      } catch {
        sendEvent(dc, {
          type: "conversation.item.create",
          item: {
            type: "function_call_output",
            call_id: callId,
            output: JSON.stringify({ error: "Tool failed" }),
          },
        });
        sendEvent(dc, {
          type: "response.create",
          response: {
            instructions: `${STOP_INSTRUCTION}\n\nSorry, that action failed. Please try again.`,
            max_output_tokens: 80,
          },
        });
      } finally {
        processingToolRef.current = false;
      }
    },
    [applyUiAction, disableMic]
  );

  const handleServerEvent = useCallback(
    (event: RealtimeServerEvent) => {
      switch (event.type) {
        case "session.created":
        case "session.updated":
          if (sessionActiveRef.current) setStatus("listening");
          break;
        case "input_audio_buffer.speech_started":
          if (sessionActiveRef.current && dcRef.current) {
            sendEvent(dcRef.current, { type: "response.cancel" });
            processingResponseRef.current = false;
            pendingResponseRef.current = false;
            clearResponseTimer();
            setUserTranscript("");
            setAssistantTranscript("");
            enableMic();
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
          if (event.transcript && sessionActiveRef.current && isUsableTranscript(event.transcript)) {
            const normalized = normalizeVoiceTranscript(event.transcript);
            setUserTranscript(normalized);
            lastTranscriptRef.current = normalized;
            void createResponse(normalized);
          } else if (sessionActiveRef.current) {
            pendingResponseRef.current = false;
            processingResponseRef.current = false;
            setStatus("listening");
          }
          break;
        case "response.output_audio_transcript.delta":
          if (event.delta) {
            disableMic();
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
    [createResponse, enableMic, disableMic, endSessionWithError, handleFunctionCall, scheduleResponse, clearResponseTimer]
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
