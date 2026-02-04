"""Assistant agent with tool calling capabilities."""

import os
from typing import List

from dotenv import load_dotenv

from smallestai.atoms.agent.clients.openai import OpenAIClient
from smallestai.atoms.agent.clients.types import ToolCall, ToolResult
from smallestai.atoms.agent.events import SDKAgentEndCallEvent
from smallestai.atoms.agent.nodes import OutputAgentNode
from smallestai.atoms.agent.tools import ToolRegistry, function_tool

load_dotenv()


class AssistantAgent(OutputAgentNode):
    """Assistant that can call tools to answer questions."""

    def __init__(self):
        super().__init__(name="assistant-agent")
        self.llm = OpenAIClient(
            model="gpt-4o-mini", 
            temperature=0.7, 
            api_key=os.getenv("OPENAI_API_KEY")
        )
        
        # Appointments storage
        self.appointments = []

        # Initialize tool registry
        self.tool_registry = ToolRegistry()
        self.tool_registry.discover(self)
        self.tool_schemas = self.tool_registry.get_schemas()

        self.context.add_message({
            "role": "system",
            "content": """You are a helpful assistant that can:
1. Check the weather for any city
2. Book appointments for users
3. List upcoming appointments

Use the available tools when users ask about weather or appointments.
Be friendly and conversational.""",
        })

    async def generate_response(self):
        """Generate response with tool calling support."""

        response = await self.llm.chat(
            messages=self.context.messages, 
            stream=True, 
            tools=self.tool_schemas
        )

        tool_calls: List[ToolCall] = []
        full_response = ""

        async for chunk in response:
            if chunk.content:
                full_response += chunk.content
                yield chunk.content
            if chunk.tool_calls:
                tool_calls.extend(chunk.tool_calls)

        # Add assistant response to context (if no tool calls)
        if full_response and not tool_calls:
            self.context.add_message({"role": "assistant", "content": full_response})

        if tool_calls:
            # Provide immediate feedback while processing tools
            # This prevents awkward silence during tool execution
            yield "One moment while I check that for you. "
            
            results: List[ToolResult] = await self.tool_registry.execute(
                tool_calls=tool_calls, parallel=True
            )

            self.context.add_messages([
                {
                    "role": "assistant",
                    "content": "",
                    "tool_calls": [
                        {
                            "id": tc.id,
                            "type": "function",
                            "function": {
                                "name": tc.name,
                                "arguments": str(tc.arguments),
                            },
                        }
                        for tc in tool_calls
                    ],
                },
                *[
            {
                "role": "tool",
                "tool_call_id": tc.id,
                "content": "" if result.content is None else str(result.content),
            }
                    for tc, result in zip(tool_calls, results)
                ],
            ])

            final_response = await self.llm.chat(
                messages=self.context.messages, stream=True
            )

            async for chunk in final_response:
                if chunk.content:
                    yield chunk.content

    @function_tool()
    def get_weather(self, city: str) -> str:
        """Get the current weather for a city.
        
        Args:
            city: The city name to check weather for.
        """
        weather_data = {
            "new york": "Sunny, 72°F",
            "london": "Cloudy, 58°F",
            "tokyo": "Clear, 68°F",
            "paris": "Rainy, 55°F",
            "san francisco": "Foggy, 62°F",
        }
        city_lower = city.lower()
        if city_lower in weather_data:
            return f"The weather in {city} is {weather_data[city_lower]}"
        return f"The weather in {city} is partly cloudy, 65°F"

    @function_tool()
    def book_appointment(self, date: str, time: str, service: str) -> str:
        """Book an appointment for the user.
        
        Args:
            date: The date for the appointment (YYYY-MM-DD format)
            time: The time for the appointment (HH:MM format)
            service: The type of service to book
        """
        appointment = {"date": date, "time": time, "service": service}
        self.appointments.append(appointment)
        return f"Booked {service} for {date} at {time}. Confirmation sent!"

    @function_tool()
    def list_appointments(self) -> str:
        """List all scheduled appointments."""
        if not self.appointments:
            return "You have no upcoming appointments."
        
        result = "Your appointments:\n"
        for i, apt in enumerate(self.appointments, 1):
            result += f"{i}. {apt['service']} on {apt['date']} at {apt['time']}\n"
        return result

    @function_tool()
    async def end_call(self) -> None:
        """End the call when user says goodbye."""
        await self.send_event(SDKAgentEndCallEvent())
        return None
