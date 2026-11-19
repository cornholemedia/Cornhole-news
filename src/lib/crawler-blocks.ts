/**
 * High-volume AI crawlers. Googlebot and Bingbot are not in this list.
 * The same names are denied at the edge in vercel.json. Keep the two in step.
 */
export const AGGRESSIVE_AI_CRAWLERS = [
  "GPTBot",
  "OAI-SearchBot",
  "CCBot",
  "ClaudeBot",
  "Claude-SearchBot",
  "anthropic-ai",
  "Bytespider",
  "Amazonbot",
  "meta-externalagent",
  "FacebookBot",
  "Diffbot",
  "ImagesiftBot",
  "Omgili",
  "PetalBot",
  "Applebot-Extended",
  "Google-Extended",
  "PerplexityBot",
  "cohere-ai",
] as const;
