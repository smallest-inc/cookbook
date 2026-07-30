import type { ToolDef } from "@/app/types";

export const KITCHEN_TOOLS: ToolDef[] = [
  {
    type: "function",
    name: "get_menu",
    description:
      "Show the Smallest Kitchen menu. Pass an optional category ('burgers', 'sides', 'drinks', 'desserts') to scope the listing.",
    parameters: {
      type: "object",
      properties: {
        category: {
          type: "string",
          description:
            "Optional: 'burgers', 'sides', 'drinks', or 'desserts'.",
        },
      },
      required: [],
    },
  },
  {
    type: "function",
    name: "get_item_details",
    description:
      "Get full details for a menu item: description, price, allergens, customisations.",
    parameters: {
      type: "object",
      properties: { item: { type: "string" } },
      required: ["item"],
    },
  },
  {
    type: "function",
    name: "add_to_order",
    description:
      "Add a menu item to the order. Increments existing-line quantity if the item is already in the order.",
    parameters: {
      type: "object",
      properties: {
        item: { type: "string" },
        quantity: { type: "integer" },
        customizations: { type: "string" },
      },
      required: ["item"],
    },
  },
  {
    type: "function",
    name: "remove_from_order",
    description: "Remove an item from the order.",
    parameters: {
      type: "object",
      properties: { item: { type: "string" } },
      required: ["item"],
    },
  },
  {
    type: "function",
    name: "update_quantity",
    description: "Set an existing line's quantity to a specific number.",
    parameters: {
      type: "object",
      properties: {
        item: { type: "string" },
        quantity: { type: "integer" },
      },
      required: ["item", "quantity"],
    },
  },
  {
    type: "function",
    name: "view_order",
    description: "Read the current order back to the customer with the subtotal.",
    parameters: { type: "object", properties: {}, required: [] },
  },
  {
    type: "function",
    name: "set_order_type",
    description: "Set whether this is a 'delivery' or 'takeout' order.",
    parameters: {
      type: "object",
      properties: { order_type: { type: "string" } },
      required: ["order_type"],
    },
  },
  {
    type: "function",
    name: "set_delivery_address",
    description: "Set the delivery address for a delivery order.",
    parameters: {
      type: "object",
      properties: { address: { type: "string" } },
      required: ["address"],
    },
  },
  {
    type: "function",
    name: "place_order",
    description: "Place the order. Always confirm with view_order first.",
    parameters: { type: "object", properties: {}, required: [] },
  },
];

// ──── local state + executor ────────────────────────────────────────────

interface MenuItem {
  name: string;
  price: number;
  description: string;
  allergens: string;
  customizations: string;
}

const MENU: Record<string, MenuItem[]> = {
  burgers: [
    {
      name: "The Classic",
      price: 9.99,
      description:
        "Beef patty, lettuce, tomato, onion, pickles, ketchup, mustard",
      allergens: "gluten, dairy",
      customizations:
        "add/remove cheese (+$0.75), bacon (+$1.50), avocado (+$1.50)",
    },
    {
      name: "The Smallest",
      price: 13.99,
      description:
        "Double patty, special sauce, American cheese, lettuce, pickles",
      allergens: "gluten, dairy, eggs",
      customizations: "add extra patty (+$3), bacon (+$1.50)",
    },
    {
      name: "The Spicy Bird",
      price: 11.99,
      description: "Crispy fried chicken, chilli sauce, coleslaw, pickles",
      allergens: "gluten, dairy, eggs",
      customizations: "swap mild sauce; add cheese (+$0.75)",
    },
    {
      name: "The Garden",
      price: 10.99,
      description: "Black bean patty, avocado, lettuce, chipotle mayo",
      allergens: "gluten, eggs (vegan w/o mayo)",
      customizations: "swap no-mayo for vegan",
    },
  ],
  sides: [
    {
      name: "Fries",
      price: 3.49,
      description: "Golden crispy fries, lightly salted",
      allergens: "may contain gluten",
      customizations: "no salt, seasoning salt",
    },
    {
      name: "Onion Rings",
      price: 4.49,
      description: "Crispy battered onion rings",
      allergens: "gluten, dairy, eggs",
      customizations: "none",
    },
  ],
  drinks: [
    {
      name: "Fountain Drink",
      price: 2.49,
      description: "Coke, Diet Coke, Sprite, Lemonade",
      allergens: "none",
      customizations: "specify flavour",
    },
    {
      name: "Milkshake",
      price: 5.99,
      description: "Vanilla, Chocolate, or Strawberry",
      allergens: "dairy, eggs",
      customizations: "specify flavour",
    },
  ],
  desserts: [
    {
      name: "Brownie",
      price: 3.49,
      description: "Warm dark chocolate brownie",
      allergens: "gluten, dairy, eggs",
      customizations: "none",
    },
  ],
};

const FLAVOR_ALIASES: Record<string, [string, string]> = {
  coke: ["Fountain Drink", "Coke"],
  "diet coke": ["Fountain Drink", "Diet Coke"],
  sprite: ["Fountain Drink", "Sprite"],
  lemonade: ["Fountain Drink", "Lemonade"],
  "vanilla shake": ["Milkshake", "Vanilla"],
  "chocolate shake": ["Milkshake", "Chocolate"],
  "strawberry shake": ["Milkshake", "Strawberry"],
};

const LOOKUP: Record<string, MenuItem & { category: string }> = {};
for (const [cat, items] of Object.entries(MENU)) {
  for (const it of items) {
    LOOKUP[it.name.toLowerCase()] = { ...it, category: cat };
  }
}

function findItem(name: string) {
  if (!name) return null;
  const key = name.trim().toLowerCase();
  if (LOOKUP[key]) return LOOKUP[key];
  for (const [k, v] of Object.entries(LOOKUP)) {
    if (k.includes(key) || key.includes(k)) return v;
  }
  return null;
}

interface OrderLine {
  item: string;
  price: number;
  quantity: number;
  customizations: string;
}

interface OrderState {
  lines: OrderLine[];
  orderType: "" | "delivery" | "takeout";
  address: string;
  placed: boolean;
  confirmation: string;
}

let order: OrderState = freshOrder();
function freshOrder(): OrderState {
  return {
    lines: [],
    orderType: "",
    address: "",
    placed: false,
    confirmation: "",
  };
}

export function resetKitchenState() {
  order = freshOrder();
}

function subtotal() {
  return order.lines.reduce((s, l) => s + l.price * l.quantity, 0);
}

const usd = (n: number) => `$${n.toFixed(2)}`;
const cap = (s: string) => s[0].toUpperCase() + s.slice(1);
const randInt = (lo: number, hi: number) =>
  Math.floor(Math.random() * (hi - lo + 1)) + lo;

export function runKitchenTool(
  name: string,
  args: Record<string, unknown>,
): string {
  try {
    switch (name) {
      case "get_menu": {
        const category = String((args.category as string) || "").toLowerCase();
        if (category && !MENU[category]) {
          return `No category '${category}'. Try: ${Object.keys(MENU).join(", ")}.`;
        }
        const cats = category ? [category] : Object.keys(MENU);
        const lines = ["Smallest Kitchen menu:"];
        for (const c of cats) {
          lines.push(`\n${c.toUpperCase()}`);
          for (const it of MENU[c]) {
            lines.push(`  ${it.name} — ${usd(it.price)} — ${it.description}`);
          }
        }
        return lines.join("\n");
      }
      case "get_item_details": {
        const it = findItem(String(args.item || ""));
        if (!it) return `No item called '${args.item}'.`;
        return `${it.name} — ${usd(it.price)}\n${it.description}\nAllergens: ${it.allergens}\nCustomisations: ${it.customizations}`;
      }
      case "add_to_order": {
        if (order.placed)
          return "This order has been placed — start a new one to add items.";
        let item = String(args.item || "");
        let customizations = String(args.customizations || "").trim();
        const alias = FLAVOR_ALIASES[item.trim().toLowerCase()];
        if (alias) {
          const [canonical, flavor] = alias;
          item = canonical;
          if (!customizations) customizations = flavor;
        }
        const found = findItem(item);
        if (!found) return `Sorry, '${item}' isn't on our menu.`;
        const qty = Math.max(1, Number(args.quantity ?? 1) || 1);
        for (const line of order.lines) {
          if (line.item === found.name && line.customizations === customizations) {
            line.quantity += qty;
            return `Updated: ${found.name} x${line.quantity} (${usd(line.price * line.quantity)}). Subtotal: ${usd(subtotal())}. Anything else?`;
          }
        }
        order.lines.push({
          item: found.name,
          price: found.price,
          quantity: qty,
          customizations,
        });
        const note = customizations ? `, ${customizations}` : "";
        return `Added ${qty}x ${found.name}${note} — ${usd(found.price * qty)}. Subtotal: ${usd(subtotal())}. Anything else?`;
      }
      case "remove_from_order": {
        const key = String(args.item || "").trim().toLowerCase();
        const idx = order.lines.findIndex(
          (l) =>
            l.item.toLowerCase() === key ||
            l.item.toLowerCase().includes(key),
        );
        if (idx < 0) return `'${args.item}' isn't in your order.`;
        const removed = order.lines[idx].item;
        order.lines.splice(idx, 1);
        return order.lines.length
          ? `Removed ${removed}. Subtotal: ${usd(subtotal())}.`
          : `Removed ${removed}. Your order is empty.`;
      }
      case "update_quantity": {
        const key = String(args.item || "").trim().toLowerCase();
        const qty = Math.max(1, Number(args.quantity ?? 1) || 1);
        const line = order.lines.find(
          (l) =>
            l.item.toLowerCase() === key ||
            l.item.toLowerCase().includes(key),
        );
        if (!line) return `'${args.item}' isn't in your order yet.`;
        line.quantity = qty;
        return `Updated ${line.item} to x${qty} (${usd(line.price * qty)}). Subtotal: ${usd(subtotal())}.`;
      }
      case "view_order": {
        if (!order.lines.length) return "Your order is empty.";
        const lines = ["Order so far:"];
        for (const l of order.lines) {
          const note = l.customizations ? `, ${l.customizations}` : "";
          lines.push(
            `  ${l.quantity}x ${l.item}${note} — ${usd(l.price * l.quantity)}`,
          );
        }
        lines.push(`\nSubtotal: ${usd(subtotal())}`);
        lines.push(
          order.orderType
            ? `Order type: ${cap(order.orderType)}`
            : "Order type: not set yet (delivery or takeout?)",
        );
        if (order.orderType === "delivery") {
          lines.push(
            `Delivery address: ${order.address || "not provided yet"}`,
          );
        }
        return lines.join("\n");
      }
      case "set_order_type": {
        const t = String(args.order_type || "").toLowerCase();
        if (t !== "delivery" && t !== "takeout")
          return "Order type must be 'delivery' or 'takeout'.";
        order.orderType = t as "delivery" | "takeout";
        return t === "delivery"
          ? "Got it, delivery. What's the address?"
          : "Got it, takeout. What name should I put on it?";
      }
      case "set_delivery_address": {
        const a = String(args.address || "").trim();
        if (!a) return "Please provide a delivery address.";
        order.address = a;
        return `Delivery address set: ${a}.`;
      }
      case "place_order": {
        if (order.placed)
          return `Order #${order.confirmation} has already been placed.`;
        if (!order.lines.length)
          return "Your order is empty — add some items first.";
        if (!order.orderType) return "Is this for delivery or takeout?";
        if (order.orderType === "delivery" && !order.address)
          return "I need a delivery address before placing the order.";
        const sub = subtotal();
        const fee = order.orderType === "delivery" ? 2.99 : 0;
        const total = sub + fee;
        const wait =
          order.orderType === "delivery"
            ? `${randInt(35, 45)}-${randInt(45, 55)} minutes`
            : `${randInt(15, 20)}-${randInt(20, 25)} minutes`;
        order.placed = true;
        order.confirmation = String(randInt(1000, 9999));
        const feeLine =
          fee > 0 ? `\nDelivery fee: ${usd(fee)}\nTotal: ${usd(total)}` : `\nTotal: ${usd(total)}`;
        return `Order placed! Confirmation #${order.confirmation}.${feeLine}\nEstimated wait: ${wait}.`;
      }
      default:
        return `Tool '${name}' is not implemented for the kitchen demo.`;
    }
  } catch (e) {
    return `Error: ${(e as Error).message || e}`;
  }
}

export function isKitchenTool(name: string): boolean {
  return KITCHEN_TOOLS.some((t) => t.name === name);
}
