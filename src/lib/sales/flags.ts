/** Feature flag: dashboard, chat, voice, analyst share one sales intelligence path. */
export function isSalesUnifiedIntelligenceEnabled(): boolean {
  return process.env.SALES_UNIFIED_INTELLIGENCE !== "false";
}
