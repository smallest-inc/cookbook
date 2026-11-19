#!/usr/bin/env python3
"""
Smallest AI Electron LLM - Tool Calling

Function calling with the Electron LLM via the OpenAI-compatible
chat/completions endpoint. The model decides when to call get_weather(city),
the script runs it locally, and the model composes the final answer from
the tool result.

Usage: python tool_calling.py "What's the weather in Mumbai?"
"""

import json
import os
import sys

from dotenv import load_dotenv
from openai import OpenAI

load_dotenv()

MODEL = "electron"
BASE_URL = "https://api.smallest.ai/waves/v1"

DEFAULT_QUESTION = "What's the weather in Mumbai right now?"

TOOLS = [
    {
        "type": "function",
        "function": {
            "name": "get_weather",
            "description": "Get the current weather for a city.",
            "parameters": {
                "type": "object",
                "properties": {
                    "city": {
                        "type": "string",
                        "description": "City name, e.g. Mumbai",
                    }
                },
                "required": ["city"],
            },
        },
    }
]


def get_weather(city: str) -> dict:
    """Stub implementation. Swap in a real weather API call."""
    return {"city": city, "condition": "partly cloudy", "temperature_c": 29}


def main():
    api_key = os.environ.get("SMALLEST_API_KEY")
    if not api_key:
        print("Error: SMALLEST_API_KEY environment variable not set", file=sys.stderr)
        sys.exit(1)

    question = sys.argv[1] if len(sys.argv) > 1 else DEFAULT_QUESTION
    client = OpenAI(api_key=api_key, base_url=BASE_URL)

    messages = [{"role": "user", "content": question}]

    # Step 1: let the model decide whether it needs the tool.
    response = client.chat.completions.create(
        model=MODEL,
        messages=messages,
        tools=TOOLS,
    )
    message = response.choices[0].message

    if message.tool_calls:
        messages.append(message)

        # Step 2: execute each requested tool locally and send back the results.
        for call in message.tool_calls:
            args = json.loads(call.function.arguments)
            print(f"Model called {call.function.name}({args})")

            result = get_weather(**args)
            messages.append({
                "role": "tool",
                "tool_call_id": call.id,
                "content": json.dumps(result),
            })

        response = client.chat.completions.create(
            model=MODEL,
            messages=messages,
            tools=TOOLS,
        )
        message = response.choices[0].message

    print(f"\n{message.content}")


if __name__ == "__main__":
    main()
