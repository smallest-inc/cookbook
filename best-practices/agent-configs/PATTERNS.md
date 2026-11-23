# Patterns From These Agents

The prompt and config patterns the two agents in this folder share. Each one names the file to look at, so you can lift it into your own agent.

## Prompt

**Disclose first, then stay consistent.** The first message says the agent is an AI assistant. The prompt repeats that the first message already said so, tells the agent to confirm it whenever asked, and never to claim to be human. Without the repeat, the model tends to dodge the question later in the call. See the Identity section of both prompts.

**Do not repeat the first message.** The configured first message already greets and introduces. The prompt says not to restate the name or add a pleasantry, so the first model turn moves the call forward. See section 5 of the collections prompt.

**Verify before you disclose.** The collections agent confirms it is speaking to the customer before it names the lender or any amount, and verifies again if a new person comes on the line. A third party hears nothing about the loan. See section 5 of the collections prompt.

**Give the model a gate before it can hang up.** The collections prompt lists the only outcomes that allow `end_call` (paid, a date within the ceiling, a callback slot, a verified terminal condition, refusal exhaustion), and the `end_call` tool description repeats the same list. Ending early on a first refusal was the most common failure this fixes. See section 4 and the `end_call` description in `agent-config.json`.

**Make persistence countable.** Instead of "be persistent", the prompt defines refusal exhaustion: the ceiling date stated, three refusals worked, three different levers used, a callback offered. The post-call metrics count the same things (`refusal_rounds_worked`, `levers_used`), so you can check the agent did what the prompt says. See section 8.

**Persistence has a stop.** A repeated request to end the call is honoured: explain once that it is a service call about an overdue account, offer a better time between 8 AM and 7 PM, then close. Hardship (illness, bereavement, a wedding in the family) and driving end the ask immediately. See section 10.

**Numbers are spoken, not formatted.** Both prompts say how to read amounts, dates and card digits aloud in Hindi and English, so the voice does not read "18,076" digit by digit. See the Language and numbers sections.

**Say what you cannot do.** The EMI agent has one tool, `end_call`, and the prompt says so: it records a request and never claims the conversion is done. The collections agent never claims to have raised a ticket or updated a do-not-call setting. Agents without the matching tool otherwise invent the action.

**Never take credentials.** Both prompts refuse OTPs, PINs, CVVs, passwords and full card, account, Aadhaar or PAN numbers, and stop the customer if they start to share one.

## Config

**Variables carry the call context.** Everything that changes per customer (name, amounts, dates, last promise, past call notes) is a `{{variable}}` with a fictional default. The prompt reads only from those, and `create_agent.py` refuses a prompt that uses a variable with no default.

**Post-call metrics mirror the prompt.** Every rule you care about has a metric: an outcome, the committed date, whether it is within the ceiling, and one `compliance_breach` flag that lists every forbidden behaviour. Review that flag on every call, not on a sample.

**Pin the voice model.** Both configs set `waves_lightning_v3_1_pro`. Lightning v3.1 retires on 30 November 2026, and the SDK's default still names it.

**Safety settings on by default.** Redaction is on in both. The outbound agent has voicemail detection on and inbound calls off. Neither carries a do-not-call override.
