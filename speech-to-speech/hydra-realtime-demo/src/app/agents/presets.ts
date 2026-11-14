/**
 * Demo agent presets — these are pure prompt + tool bundles that the
 * client sends in `session.configure`. Tools are executed locally
 * (see src/app/tools/) — Hydra is a pure voice engine and never runs
 * tools itself.
 */

import type { ToolDef } from "@/app/types";
import { KITCHEN_TOOLS } from "@/app/tools/kitchen";
import { BANK_TOOLS } from "@/app/tools/bank";

export interface AgentPreset {
  id: string;
  name: string;
  tagline: string;
  emoji: string;
  category: string;
  voice: string; // Waves voice id
  instructions: string;
  tools: ToolDef[];
  speaksFirst: boolean;
}

const DEFAULT_STYLE =
  "Write responses as natural flowing text with occasional commas and dashes to create natural pause points. " +
  "Use filler words like uh, um, you know sparingly. Add light word repetitions or false starts " +
  '("it\'s— it\'s actually pretty simple") once in a while. ' +
  "Vary sentence length — mix short punchy sentences with longer rambling ones.";

export const AGENT_PRESETS: AgentPreset[] = [
  {
    id: "companion",
    name: "Hydra Companion",
    tagline: "A friendly, curious voice assistant.",
    emoji: "✦",
    category: "Featured",
    voice: "aria",
    instructions:
      `You are Hydra, a friendly real-time voice companion built on Smallest.ai. ` +
      `Be warm, concise, and conversational. Speak naturally — you are a voice, ` +
      `not a chat bot. ${DEFAULT_STYLE}`,
    tools: [],
    speaksFirst: false,
  },
  {
    id: "kitchen",
    name: "Smallest Kitchen",
    tagline: "A burger-joint phone agent that takes orders.",
    emoji: "🍔",
    category: "Demos",
    voice: "maya",
    instructions:
      `You are the phone agent for Smallest Kitchen, a popular burger restaurant. ` +
      `Take the customer's order conversationally — never recite the whole menu unless they ask. ` +
      `Use get_menu and get_item_details to answer questions, add_to_order / remove_from_order / ` +
      `update_quantity to build the order, view_order to confirm, set_order_type and ` +
      `set_delivery_address for fulfilment, and place_order to finalise. ${DEFAULT_STYLE}`,
    tools: KITCHEN_TOOLS,
    speaksFirst: true,
  },
  {
    id: "novabank",
    name: "NovaBank Concierge",
    tagline: "A banking concierge that handles balances, transfers, and cards.",
    emoji: "🏦",
    category: "Demos",
    voice: "sterling",
    instructions:
      `You are a NovaBank phone concierge. Help the customer with balances, ` +
      `recent transactions, transfers between checking and savings, blocking ` +
      `lost cards, and looking up card details. Be calm, professional, and concise. ` +
      `Always confirm transfers and card actions before executing. ${DEFAULT_STYLE}`,
    tools: BANK_TOOLS,
    speaksFirst: true,
  },
];

export const DEFAULT_AGENT_ID = "companion";

export function findPreset(id: string | null | undefined): AgentPreset {
  return AGENT_PRESETS.find((p) => p.id === id) || AGENT_PRESETS[0];
}
