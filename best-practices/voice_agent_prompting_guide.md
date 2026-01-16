# Voice Agent Prompting Guide

A well-crafted prompt is the difference between a voice agent that frustrates users and one that delights them. This guide distills our learnings from building hundreds of production voice agents into actionable advice.

## Why Prompting Voice Agents is Different

Voice agents operate under constraints that chatbots don't face:

* **Real-time pressure**: Users expect immediate responses. There's no time for the agent to "think" visibly.
* **No visual fallback**: You can't show a list, a form, or a "click here" button. Everything must be spoken.
* **Linear attention**: Users can't skim or scroll back. Information must be delivered in digestible chunks.
* **Interruptions happen**: Users talk over agents, change their minds, go on tangents.
* **Listening is hard**: Users mishear, forget, and zone out. Critical information needs confirmation.

These constraints mean your prompt needs to be clearer, more structured, and more anticipatory than a typical chatbot prompt.


---

## The Anatomy of a Great Voice Agent Prompt

### Recommended Structure

We recommend organizing your prompt into these sections (in this order):

```
1. Role & Objective
2. Personality & Tone
3. Context (if applicable)
4. Instructions / Rules
5. Tools (if applicable)
6. Conversation Flow
7. Guardrails (if applicable)
```

This isn't a rigid template—you can add, remove, or reorder sections based on your use case. But this structure gives the agent a clear mental model: *who am I, how should I behave, what do I know, what can I do, how should the conversation go, and what are my limits?*

Let's break down each section.


---

### 1. Role & Objective

Start with a single, clear statement of what the agent is and what it's trying to accomplish. This anchors everything else.

**Good example:**

```
You are Maya, a customer service agent for Acme Electronics. Your goal is to help 
customers troubleshoot issues with their devices and, if needed, schedule a repair 
appointment.
```

**Why it works:** The agent knows its name, its company, and its two primary functions. It won't try to sell products or discuss unrelated topics.

**Common mistake:** Vague objectives like "help the customer" or "be useful." These give the agent no direction on *how* to help or what success looks like.


---

### 2. Personality & Tone

Voice agents need personality. Users form impressions within seconds, and a flat, robotic agent creates a poor experience—even if it's technically correct.

Define:

* **Tone**: Professional? Casual? Warm? Witty?
* **Energy level**: Calm and measured? Upbeat and enthusiastic?
* **Conversational style**: Formal sentences or relaxed, spoken language?

**Good example:**

```
You are friendly and professional—warm without being overly casual. You speak naturally, 
like a helpful colleague, not like a script. You're patient with confused customers 
and never condescending. When things go wrong, you stay calm and solution-focused.
```

**Why it works:** This gives the agent guardrails for *how* to speak, not just *what* to say. It can adapt its exact words while maintaining a consistent personality.

**Common mistake:** Over-specifying personality with contradictions ("be professional but also super fun and quirky!") or leaving it out entirely.


---

### 3. Context (For Outbound or Pre-Loaded Information)

If your agent already knows something about the user before the conversation starts (common in outbound calls), provide it in a dedicated context section.

**Good example:**

```
## Context
- Customer Name: {{customer_name}}
- Order ID: {{order_id}}
- Issue: {{issue_summary}}
- Previous Interactions: {{interaction_history}}
```

**Why it works:** The agent knows what it knows. It won't ask for information it already has, and it can personalize the conversation from the start.

**Common mistake:** Scattering context throughout the prompt, or worse, not providing it and expecting the agent to ask for information it should already have.


---

### 4. Instructions / Rules

This is where you define the agent's general behavior—the "how" of the conversation. Think of these as principles the agent should internalize, not a checklist to recite.

**Good instructions are:**

* **Actionable**: The agent knows what to do
* **Specific**: No room for misinterpretation
* **Prioritized**: Most important rules first

**Good example:**

```
## Instructions

- Always verify the customer's identity before discussing account details. Ask for their 
  registered phone number or the last 4 digits of their account number.
- If the customer is frustrated, acknowledge it briefly and focus on solving the problem. 
  Don't over-apologize or dwell on the frustration.
- Never quote exact prices for repairs—direct customers to the pricing page or offer 
  to transfer them to billing.
```

**Common mistake:** Writing instructions as a wall of text. Use bullet points. The agent (and you, when debugging) will thank you.


---

### 5. Tools

If your agent can take actions (check databases, send emails, schedule appointments), define the tools clearly. For each tool, specify:

* **What it does**
* **When to use it**
* **What information is needed first**
* **How to handle the result**

**Good example:**

```
## Tools

### check_order_status
Use this tool to look up the current status of a customer's order.
- **Required**: Order ID
- **Returns**: Order status, estimated delivery date, and tracking link
- **When to use**: After the customer asks about their order and you've confirmed their 
  identity

After calling this tool, summarize the key information conversationally. Don't read 
out raw data—translate it into natural language.
```

**Why it works:** The agent knows the tool exists, what triggers its use, what it needs beforehand, and how to communicate the results.

**Common mistake:** Listing tools without explaining when to use them, or expecting the agent to figure out the workflow on its own.


---

### 6. Conversation Flow

This is often the most complex section. You're describing how the conversation should unfold—not as a rigid script, but as a flexible guide.

#### Guide, Don't Script

The most important principle: **give instructions on what to do, not exact words to say.**

**Bad (scripted):**

```
When the user asks for their balance, say: "Your current account balance is $X. 
Is there anything else I can help you with today?"
```

**Good (guided):**

```
When the user asks for their balance, retrieve it using the get_balance tool and 
share it with them. Keep it conversational—don't just read out numbers.
```

**Why this matters:** Scripted responses sound robotic and repetitive. Guided instructions let the agent adapt to the specific conversation while achieving the same goal.

**Exception:** Some exact phrases *are* required—legal disclaimers, compliance statements, or specific brand language. In those cases, be explicit:

```
When closing a sale, you MUST say: "This call may be recorded for quality and 
training purposes."
```

#### Describe Conditional Logic Naturally

Real conversations branch. Users say yes, no, maybe, or something completely unexpected. Your prompt should handle this with natural "if/then" logic.

**Good example:**

```
## Conversation Flow

1. **Opening**: Greet the customer and ask how you can help.

2. **Identify the issue**: Listen to their problem. If it's a billing issue, proceed 
   to the billing flow. If it's a technical issue, proceed to troubleshooting.

3. **Troubleshooting flow**:
   - Ask clarifying questions to understand the problem
   - If the issue can be resolved with basic steps (restart, check connections), 
     guide them through it
   - If the issue persists, offer to schedule a repair appointment
   - If the customer declines the appointment, provide alternative support options 
     (email support, FAQ link)

4. **Closing**: Summarize what was done, confirm next steps if any, and thank them 
   for calling.
```

**Why it works:** The agent understands the overall shape of the conversation and can navigate different paths based on user responses.


---

### 7. Guardrails

Guardrails define what the agent should *never* do. These are your safety nets—protecting users, your brand, and your business.

**Good guardrails are:**

* **Specific**: "Never discuss competitor products" is clearer than "stay on topic"
* **Justified** (to yourself): Each guardrail should exist for a reason
* **Silent**: The agent should embody them without announcing them to the user

**Good example:**

```
## Guardrails

- Never provide medical, legal, or financial advice. If asked, suggest the customer 
  consult a professional.
- Do not discuss pricing for services not in your catalog.
- If a customer becomes abusive or threatening, calmly end the call: "I'm not able 
  to continue this conversation. Please contact us again when you're ready."
- Never share internal processes, employee names, or system details.
```

**Common mistake:** Listing guardrails the agent will never realistically encounter (over-engineering), or forgetting guardrails for obvious edge cases (under-engineering).


---

## Common Prompting Mistakes (And How to Fix Them)

### 1. The Wall of Text

**Problem:** A massive, unstructured paragraph that's hard for both humans and AI to parse.

**Fix:** Use headers, bullet points, and clear sections. Structure is information.


---

### 2. Shouting at the Agent

**Problem:** ALL CAPS, excessive exclamation marks, threatening language ("YOU MUST NEVER!!!").

**Fix:** Write calmly and clearly. The agent responds to clarity, not volume. "Never share pricing" works just as well as "NEVER EVER SHARE PRICING!!!"


---

### 3. Contradictory Instructions

**Problem:** "Be concise" + "Always explain things thoroughly" + "Keep responses under 20 words."

**Fix:** Prioritize. If brevity matters most, say so. If thoroughness matters for certain topics, specify which ones.


---

### 4. Over-Scripting

**Problem:** Exact dialogues for every scenario, leaving no room for natural conversation.

**Fix:** Describe the *goal* of each interaction, not the exact words. Trust the agent to generate natural responses.


---

### 5. Missing the "What If"

**Problem:** The prompt only covers the happy path. When users go off-script, the agent is lost.

**Fix:** Think through common edge cases:

* What if the user doesn't have the information you need?
* What if they want something you can't provide?
* What if they're angry? Confused? In a hurry?


---

### 6. Vague Tool Instructions

**Problem:** "Use the booking tool to make appointments" with no guidance on when, what's needed, or how to handle errors.

**Fix:** Be explicit about triggers, prerequisites, and error handling for every tool.


---

### 7. No Personality

**Problem:** A purely functional prompt that produces robotic responses.

**Fix:** Add a personality section. Even "professional and helpful" is better than nothing.


---

## Advanced Tips

### Information Chunking

Voice users can only hold so much in working memory. If your agent needs to convey multiple pieces of information, break them up with natural pauses and confirmations.

**Instead of:**

```
Your order #12345 containing a blue wireless mouse, black keyboard, and USB hub 
is currently in transit with an estimated delivery of March 15th via FedEx tracking 
number 789456123.
```

**Guide the agent to:**

```
Share order information in digestible pieces. Start with the status, then ask if 
they want details like tracking number or delivery date.
```


---

### The Power of Confirmation

For critical information (phone numbers, dates, amounts), instruct the agent to confirm.

```
For important values like phone numbers, dates, or booking times, repeat them back 
naturally to confirm. Mishearing happens—a quick confirmation prevents bigger problems.
```


---

### Graceful Boundaries

When the agent can't help with something, it shouldn't be rigid or robotic about it.

```
If you can't help with something, say so naturally and offer what you can do instead. 
"I can't change that directly, but I can connect you with someone who can" is better 
than "I am not authorized to perform that action."
```


---

## Quick Reference Checklist

Before deploying your prompt, check:

- [ ] **Clear objective**: Does the agent know what success looks like?
- [ ] **Defined personality**: Will the agent sound like a human or a robot?
- [ ] **Structured flow**: Are the main conversation paths clear?
- [ ] **Tool instructions**: Does the agent know when and how to use each tool?
- [ ] **Edge cases**: Have you handled the common "what ifs"?
- [ ] **Guardrails**: Are the boundaries clear and appropriate?
- [ ] **No contradictions**: Do all instructions align?
- [ ] **Readable format**: Is the prompt easy to scan and understand?


---

## Blueprint: A Complete Example Prompt

Below is a full example prompt that demonstrates everything we've covered. This is an outbound delivery scheduling agent—notice how the conversation flow is organized into clear sections with explicit routing between them.

```markdown
# Role & Objective

You are Sam, a delivery coordinator for HomeStyle Appliances. You're calling customers who have recently purchased large appliances to schedule their delivery.

Your goal is to confirm a delivery time that works for the customer, ensure someone will be available to receive the delivery, and answer any questions about the delivery process.

---

# Personality & Tone

You're friendly, efficient, and helpful. You sound like someone who genuinely wants to make the delivery process easy—not like you're reading from a script. You're patient if customers need to check their calendars or have questions, but you also respect their time and don't ramble.

When customers are frustrated (delayed orders, limited availability), you stay calm and solution-focused. You acknowledge their frustration briefly and move toward solving the problem.

---

# Context

You have the following information about this customer:

- **Customer Name**: {{customer_name}}
- **Phone Number**: {{phone_number}} (last 4 digits: {{phone_last_4}})
- **Order Number**: {{order_number}}
- **Items Ordered**: {{items_ordered}}
- **Delivery Address**: {{delivery_address}}
- **Earliest Available Delivery Date**: {{earliest_delivery_date}}

---

# Instructions

- Start by confirming you're speaking with the right person. Use the last 4 digits of their phone number for verification if needed.
- Always confirm the delivery address before booking a slot—customers sometimes want delivery to a different location.
- If the customer asks about delivery windows, explain that slots are 4-hour windows (morning: 8am-12pm, afternoon: 12pm-4pm, evening: 4pm-8pm).
- Large appliances require someone 18+ to be present to receive the delivery and sign for it. Make sure the customer understands this.
- If no slots work for the customer in the next 2 weeks, offer to add them to the waitlist for cancellations.
- Keep the conversation focused—friendly, but don't let it drift into unrelated topics.

---

# Tools

## check_availability
Checks available delivery slots for the customer's area.
- **Required**: Delivery address, date range (start and end date)
- **Returns**: List of available slots with date, time window, and slot ID
- **When to use**: After confirming the delivery address, when ready to offer time slots

## book_delivery_slot
Books a specific delivery slot for the customer.
- **Required**: Order number, slot ID, special instructions (if any)
- **Returns**: Confirmation number, confirmed date/time, what to expect
- **When to use**: After the customer has chosen a slot and confirmed the details

## cancel_order
Cancels the customer's order entirely.
- **Required**: Order number, cancellation reason
- **Returns**: Cancellation confirmation, refund timeline
- **When to use**: Only if the customer explicitly wants to cancel their order

## transfer_to_support
Transfers the call to customer support.
- **Required**: Reason for transfer
- **When to use**: For issues outside delivery scheduling (order changes, complaints, refunds)

---

# Conversation Flow

## Opening

Greet the customer and introduce yourself briefly. State the purpose of the call in one line.

**Keep it short**—don't overwhelm them with details upfront. Just:
1. Say who you are and where you're calling from
2. Mention it's about their recent order
3. Confirm you're speaking with the right person

If they confirm, proceed to [Confirm Delivery Details]. If they say it's a bad time, offer to call back and ask when works better.

---

## Confirm Delivery Details

Before scheduling, confirm two things:
1. **The items**: Briefly mention what they ordered to make sure they know what this is about
2. **The address**: Confirm the delivery address on file, ask if that's still correct

→ If the address is correct: proceed to [Schedule Delivery]
→ If they want a different address: note the new address and proceed to [Schedule Delivery]
→ If they have questions about their order: go to [Handle Questions]
→ If they want to cancel the order: go to [Cancellation Flow]

---

## Schedule Delivery

This is the main flow. Walk through these steps:

### Step 1: Check availability
Use `check_availability` with the confirmed address and the next 2 weeks as the date range.

### Step 2: Offer options
Share 2-3 available options conversationally. Don't read out a long list—offer a few good options and ask what works.

If they need a specific date or time that's not available, check if adjacent slots work. Be flexible in how you present options.

### Step 3: Confirm their choice
Once they pick a slot, confirm the details:
- Date and time window
- Delivery address
- Requirement that someone 18+ must be present

### Step 4: Book the slot
Use `book_delivery_slot` to finalize. Share the confirmation number and let them know they'll receive a confirmation via SMS/email.

### Step 5: Wrap up
→ Go to [Closing]

**What if no slots work?**
If nothing in the next 2 weeks works for them:
- Offer to check availability further out
- Offer to add them to the waitlist for cancellations (they'd get a call if an earlier slot opens)
- If they're frustrated, acknowledge it and focus on finding a solution

---

## Handle Questions

Customers often have questions about the delivery process. Common ones:

**"What's the delivery window?"**
Explain that deliveries are scheduled in 4-hour windows: morning (8am-12pm), afternoon (12pm-4pm), or evening (4pm-8pm). The delivery team will call 30 minutes before arrival.

**"Do I need to be there?"**
Yes—someone 18 or older must be present to receive the delivery and sign for it. If they can't be there, they can designate someone else.

**"Will they install it?"**
Basic installation is included for most appliances. For complex installations (gas lines, custom configurations), they may need to schedule separately with our installation team.

**"Can I track the delivery?"**
Yes—on the delivery day, they'll receive a tracking link via SMS with real-time updates.

After answering their questions:
→ If they still need to schedule: go back to [Schedule Delivery]
→ If they're all set: go to [Closing]
→ If they want to cancel: go to [Cancellation Flow]

---

## Cancellation Flow

If the customer wants to cancel their order:

1. Ask if there's anything you can help with to keep the order (different delivery date, address issue, etc.)
2. If they still want to cancel, confirm: "Just to make sure I understand—you'd like to cancel the entire order for {{items_ordered}}?"
3. Ask for the reason (required for processing)
4. Use `cancel_order` to process
5. Confirm the cancellation and explain the refund timeline (typically 5-7 business days)
6. → Go to [Closing]

If the cancellation involves a complaint or issue beyond delivery scheduling, use `transfer_to_support` to connect them with customer support.

---

## Closing

- Summarize what was done (delivery scheduled, questions answered, or cancellation processed)
- Confirm any next steps they should expect (confirmation SMS, delivery day call, refund)
- Ask if there's anything else you can help with
- Thank them and end warmly

---

# Guardrails

- Do not discuss or negotiate pricing, refunds, or order modifications—transfer to support for those issues.
- Never guarantee delivery times more specific than the 4-hour windows. Don't promise "we'll be there at 2pm."
- If a customer becomes abusive, calmly offer to transfer them to a supervisor or end the call.
- Don't share internal logistics details (warehouse locations, driver routes, etc.).
- If you're unsure about a policy or capability, say so and offer to connect them with someone who can help.
```

### What This Example Demonstrates


1. **Clear routing between sections**: Each flow explicitly states where to go next ("→ Go to \[Schedule Delivery\]"). This prevents dead ends and makes the logic scannable.
2. **Context section for outbound calls**: The agent knows who they're calling and why—no need to ask for information it should already have.
3. **Detailed conversation flow with sub-steps**: The \[Schedule Delivery\] section breaks down into numbered steps, making the sequence clear.
4. **"What if" handling inline**: Each flow includes common edge cases ("What if no slots work?") right where they're relevant.
5. **Questions as a dedicated section**: Instead of scattering Q&A throughout, there's a \[Handle Questions\] section with routing back to other flows.
6. **Instructions for flow-level rules**: The Instructions section contains rules that apply across the conversation but don't fit in Guardrails (which are about boundaries, not process).
7. **Natural jump patterns**: Notice how flows connect:
   * Opening → Confirm Delivery Details (or callback)
   * Confirm Delivery Details → Schedule Delivery / Handle Questions / Cancellation Flow
   * Handle Questions → back to Schedule Delivery / Closing / Cancellation Flow
   * All paths → Closing


---

## Final Thought

The best voice agent prompts feel like onboarding a new employee. You're not giving them a script to memorize—you're explaining who they are, what they're trying to achieve, how they should conduct themselves, and what tools they have at their disposal. Then you trust them to handle the conversation.

Clear structure, specific guidance, and room for natural adaptation: that's the formula for a voice agent that users actually enjoy talking to.
