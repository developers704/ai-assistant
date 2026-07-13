/** Feature flags for gradual Alexa unified orchestrator migration. */
function flag(name: string, defaultOn = false): boolean {
  const v = process.env[name];
  if (v === undefined || v === "") return defaultOn;
  return /^(1|true|yes|on)$/i.test(v.trim());
}

export const AlexaFlags = {
  unifiedOrchestrator: () => flag("ALEXA_UNIFIED_ORCHESTRATOR", false),
  dynamicTools: () => flag("ALEXA_DYNAMIC_TOOLS", false),
  structuredMemory: () => flag("ALEXA_STRUCTURED_MEMORY", false),
  unifiedConfirmations: () => flag("ALEXA_UNIFIED_CONFIRMATIONS", false),
  traceLogging: () => flag("ALEXA_TRACE_LOGGING", false),
  limitedVoiceFastPath: () => flag("ALEXA_LIMITED_VOICE_FASTPATH", false),
} as const;
