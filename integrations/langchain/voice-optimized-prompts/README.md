# Voice-Optimized Prompts

Prompt templates tuned for spoken output — our recommended way to prompt LLMs for voice AI with Smallest AI.

## Why This Matters

LangChain prompts are designed for text. Voice AI is different — your LLM output goes through TTS and gets spoken aloud, so it needs to sound natural, be concise, and avoid anything that doesn't translate to speech (markdown, bullet lists, URLs).

## Requirements

> Base dependencies are installed via the root `requirements.txt`. See the [main README](../../../README.md#usage) for setup. Install LangChain deps from `integrations/langchain/`. Copy `../.env.sample` to `.env` and add your API keys.

## Usage

```python
from prompts import VOICE_AGENT_SYSTEM_PROMPT, voice_response_chain

chain = voice_response_chain()
response = chain.invoke({"input": "Tell me about your pricing"})
# Short, spoken-friendly text ready for TTS
```

## Structure

```
voice-optimized-prompts/
└── prompts.py    # Prompt templates + clean_for_voice helper + ready-to-use chains
```

## Why Voice Prompts Are Different

| Text output | Voice output |
|-------------|-------------|
| Users scan and skim | Users must listen linearly |
| Bullet lists are helpful | Bullet lists are confusing when spoken |
| Markdown formatting works | Markdown syntax gets read aloud |
| Long responses are fine | Long responses lose the listener |

## The Rules

1. **Keep it short** — 1-3 sentences per turn
2. **No formatting** — no markdown, bullets, code blocks
3. **Conversational language** — write the way people talk
4. **One idea per turn** — don't dump info, ask if they want more
5. **Explicit turn-taking** — end with a question or pause cue
6. **Numbers/abbreviations** — spell out awkward numbers, avoid "e.g."
7. **No meta-commentary** — never say "As an AI..."

## Prompt Templates

### 1. General Voice Agent

A flexible base prompt for any voice assistant. Covers the fundamental rules for spoken output.

**When to use:** Starting point for custom voice agents, general Q&A, or when no specialized prompt fits.

```python
VOICE_AGENT_SYSTEM_PROMPT = """\
You are a voice AI assistant. Your responses will be converted to speech \
using Smallest AI's Lightning TTS and played back to the user in real time.

Rules:
- Keep responses to 1-3 sentences. Users are listening, not reading.
- Use natural, conversational language. Write the way people talk.
- Never use markdown, bullet points, numbered lists, or any formatting.
- Never mention URLs, links, or ask users to "click" anything.
- Spell out numbers when they'd sound awkward as digits.
- Avoid abbreviations. Say "for example" not "e.g.".
- End with a clear question or pause point so the user knows it's their turn.
- If you don't know something, say so briefly. Don't pad with filler."""
```

### 2. Customer Service Agent

Tuned for support calls — acknowledges frustration, confirms understanding, walks through steps one at a time.

**When to use:** Help desks, support lines, troubleshooting flows, account assistance.

```python
from prompts import VOICE_CUSTOMER_SERVICE_PROMPT
chain = voice_response_chain(system_prompt=VOICE_CUSTOMER_SERVICE_PROMPT)
```

### 3. Sales Assistant

Enthusiastic but not pushy. Leads with benefits, asks qualifying questions naturally.

**When to use:** Product inquiries, demos, pricing questions, lead qualification calls.

```python
from prompts import VOICE_SALES_PROMPT
chain = voice_response_chain(system_prompt=VOICE_SALES_PROMPT)
```

### 4. Receptionist

Short, efficient, polite. Asks one question at a time, confirms details by repeating them.

**When to use:** Front desk routing, appointment scheduling, call screening.

```python
from prompts import VOICE_RECEPTIONIST_PROMPT
chain = voice_response_chain(system_prompt=VOICE_RECEPTIONIST_PROMPT)
```

### With output validation

```python
import re

def clean_for_voice(text: str) -> str:
    """Strip formatting artifacts that shouldn't be spoken."""
    text = re.sub(r'\*+', '', text)           # Remove bold/italic markers
    text = re.sub(r'`[^`]*`', '', text)       # Remove inline code
    text = re.sub(r'\[([^\]]+)\]\([^)]+\)', r'\1', text)  # [text](url) → text
    text = re.sub(r'^\s*[-*]\s+', '', text, flags=re.MULTILINE)  # Remove list markers
    text = re.sub(r'^\s*\d+\.\s+', '', text, flags=re.MULTILINE)  # Remove numbered lists
    text = re.sub(r'#{1,6}\s+', '', text)     # Remove headers
    return text.strip()

chain = prompt | llm | (lambda resp: clean_for_voice(resp.content))
```

## API Reference

- [Lightning TTS Overview](https://waves-docs.smallest.ai/models/text-to-speech/overview)
- [LangChain Prompts](https://python.langchain.com/docs/concepts/prompt_templates/)

## Next Steps

- [Conversation Memory for Voice](../conversation-memory-for-voice/) — Memory strategies that pair with these prompts
- [TTS as LangChain Tool](../tts-as-langchain-tool/) — Turn the text output into speech
- [Voice AI Agent](../examples/voice-ai-agent/) — Full end-to-end example
