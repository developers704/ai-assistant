/**
 * Deterministic draft generators for Instagram captions and comment replies.
 *
 * SAFETY: These functions ONLY produce draft text. They never publish, never
 * reply, and never call the Meta write APIs. Publishing is intentionally not
 * implemented in this phase.
 */

const BRAND = "Valliani Jewelers";

const CAPTION_HASHTAGS = [
  "#VallianiJewelers",
  "#FineJewelry",
  "#Gold",
  "#Diamonds",
  "#Bridal",
  "#LuxuryJewelry",
];

function cleanTopic(topic: string): string {
  return topic.replace(/\s+/g, " ").trim();
}

/** Build 2-3 caption variations for a topic. Draft only — never published. */
export function draftInstagramCaption(topicRaw: string): {
  variations: string[];
  hashtags: string[];
  note: string;
} {
  const topic = cleanTopic(topicRaw) || "our latest collection";
  const variations = [
    `✨ ${capitalize(topic)} — crafted to be treasured. Discover the ${BRAND} difference in person or online.`,
    `New from ${BRAND}: ${topic}. Timeless design, expert craftsmanship, and a shine that lasts a lifetime. 💎`,
    `Fall in love with ${topic}. Visit your nearest ${BRAND} showroom to see it up close.`,
  ];
  return {
    variations,
    hashtags: CAPTION_HASHTAGS,
    note: "Draft only. Publishing needs confirmation and is not enabled yet.",
  };
}

/** Build a courteous reply draft for a comment. Draft only — never posted. */
export function draftCommentReply(
  commentText: string,
  commenter?: string
): { reply: string; note: string } {
  const who = commenter ? `@${commenter.replace(/^@/, "")}` : "there";
  const lower = commentText.toLowerCase();

  let reply: string;
  if (/\b(price|cost|how much|kitna|rate)\b/.test(lower)) {
    reply = `Hi ${who}, thank you for your interest! Please DM us or visit your nearest ${BRAND} store and our team will share full pricing and options. 💎`;
  } else if (/\b(love|beautiful|gorgeous|stunning|amazing|nice)\b/.test(lower)) {
    reply = `Thank you so much, ${who}! 💛 We're thrilled you love it. Come see it in person at ${BRAND}.`;
  } else if (/\b(where|location|store|address|near)\b/.test(lower)) {
    reply = `Hi ${who}! We'd love to help — DM us your city and we'll point you to the closest ${BRAND} location.`;
  } else {
    reply = `Hi ${who}, thanks for reaching out! Our ${BRAND} team would be happy to help — feel free to DM us with any questions. 💎`;
  }

  return {
    reply,
    note: "Draft only. Replying needs confirmation and is not enabled yet.",
  };
}

function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}
