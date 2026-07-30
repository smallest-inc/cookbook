import type { ToolDef } from "@/app/types";

export const BANK_TOOLS: ToolDef[] = [
  {
    type: "function",
    name: "get_balance",
    description: "Read the customer's account balance.",
    parameters: {
      type: "object",
      properties: {
        account: {
          type: "string",
          description: "'checking' or 'savings'. Leave empty for both.",
        },
      },
      required: [],
    },
  },
  {
    type: "function",
    name: "recent_transactions",
    description: "List the most recent transactions on an account.",
    parameters: {
      type: "object",
      properties: {
        account: { type: "string", description: "'checking' or 'savings'." },
        limit: { type: "integer" },
      },
      required: [],
    },
  },
  {
    type: "function",
    name: "transfer_money",
    description: "Move money between the customer's checking and savings.",
    parameters: {
      type: "object",
      properties: {
        from_account: { type: "string" },
        to_account: { type: "string" },
        amount: { type: "number" },
      },
      required: ["from_account", "to_account", "amount"],
    },
  },
  {
    type: "function",
    name: "block_card",
    description: "Block a card that has been lost or stolen.",
    parameters: {
      type: "object",
      properties: {
        card_type: { type: "string", description: "'debit' or 'credit'." },
        reason: { type: "string" },
      },
      required: ["card_type"],
    },
  },
];

interface BankState {
  balances: { checking: number; savings: number };
  tx: { checking: Tx[]; savings: Tx[] };
  blocked: Record<string, { reason: string }>;
}
interface Tx {
  date: string;
  merchant: string;
  amount: number;
}

const SEED: BankState = {
  balances: { checking: 4217.83, savings: 12500.0 },
  tx: {
    checking: [
      { date: "May 6", merchant: "Whole Foods", amount: -84.21 },
      { date: "May 5", merchant: "Uber Ride", amount: -18.5 },
      { date: "May 4", merchant: "Salary Deposit", amount: 4200.0 },
      { date: "May 3", merchant: "Netflix", amount: -15.99 },
      { date: "May 2", merchant: "Trader Joe's", amount: -57.32 },
    ],
    savings: [
      { date: "May 1", merchant: "Transfer from Checking", amount: 500.0 },
      { date: "Apr 1", merchant: "Transfer from Checking", amount: 500.0 },
      { date: "Feb 1", merchant: "Interest Credit", amount: 18.42 },
    ],
  },
  blocked: {},
};

let state: BankState = clone(SEED);
function clone(s: BankState): BankState {
  return JSON.parse(JSON.stringify(s));
}

export function resetBankState() {
  state = clone(SEED);
}

const usd = (n: number) => `$${n.toFixed(2)}`;
const cap = (s: string) => s[0].toUpperCase() + s.slice(1);

export function isBankTool(name: string): boolean {
  return BANK_TOOLS.some((t) => t.name === name);
}

export function runBankTool(
  name: string,
  args: Record<string, unknown>,
): string {
  switch (name) {
    case "get_balance": {
      const a = String(args.account || "").toLowerCase();
      if (a === "checking" || a === "savings") {
        return `${cap(a)}: ${usd(state.balances[a as "checking" | "savings"])}.`;
      }
      return `Checking: ${usd(state.balances.checking)}. Savings: ${usd(state.balances.savings)}.`;
    }
    case "recent_transactions": {
      const a =
        (String(args.account || "checking").toLowerCase() as "checking" | "savings") ||
        "checking";
      if (a !== "checking" && a !== "savings")
        return "Account must be 'checking' or 'savings'.";
      const limit = Math.max(1, Math.min(15, Number(args.limit ?? 5) || 5));
      const list = state.tx[a].slice(0, limit);
      if (!list.length) return `No recent transactions on ${a}.`;
      const lines = [`Last ${list.length} transactions on ${a}:`];
      for (const t of list) {
        const sign = t.amount >= 0 ? "+" : "-";
        lines.push(`  ${t.date} — ${t.merchant}: ${sign}${usd(Math.abs(t.amount))}`);
      }
      return lines.join("\n");
    }
    case "transfer_money": {
      const from = String(args.from_account || "").toLowerCase() as
        | "checking"
        | "savings";
      const to = String(args.to_account || "").toLowerCase() as
        | "checking"
        | "savings";
      if (!["checking", "savings"].includes(from) ||
          !["checking", "savings"].includes(to))
        return "Accounts must be 'checking' or 'savings'.";
      if (from === to) return "From and to must be different.";
      const amt = Number(args.amount);
      if (!(amt > 0)) return "Amount must be positive.";
      if (state.balances[from] < amt)
        return `Insufficient funds: ${from} balance is ${usd(state.balances[from])}.`;
      state.balances[from] -= amt;
      state.balances[to] += amt;
      state.tx[from].unshift({
        date: "Today",
        merchant: `Transfer to ${cap(to)}`,
        amount: -amt,
      });
      state.tx[to].unshift({
        date: "Today",
        merchant: `Transfer from ${cap(from)}`,
        amount: amt,
      });
      return `Transferred ${usd(amt)} from ${from} to ${to}. New ${from}: ${usd(state.balances[from])}, ${to}: ${usd(state.balances[to])}.`;
    }
    case "block_card": {
      const k = String(args.card_type || "").toLowerCase();
      if (k !== "debit" && k !== "credit")
        return "card_type must be 'debit' or 'credit'.";
      const reason = String(args.reason || "customer request");
      if (state.blocked[k])
        return `${cap(k)} card is already blocked.`;
      state.blocked[k] = { reason };
      return `${cap(k)} card blocked. Reason: ${reason}. A replacement will arrive in 3–5 business days.`;
    }
    default:
      return `Tool '${name}' is not implemented for the bank demo.`;
  }
}
