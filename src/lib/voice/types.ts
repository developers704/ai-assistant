/** Shared voice types safe for client bundles. */

export interface VoiceComposeHandoff {
  to: string;
  subject: string;
  body: string;
  toName?: string;
}

export interface VoiceUiAction {
  type: "navigate";
  path: string;
  /** Prefill Email compose after navigation */
  compose?: VoiceComposeHandoff;
}
