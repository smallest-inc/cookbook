"""
Agent with Custom Tools
========================
Build an agent with function tools that the LLM can call.

Run: python server.py
Then: smallestai agent chat
"""

from smallestai.atoms.agent.nodes.output_agent import OutputAgentNode
from smallestai.atoms.agent.tools import function_tool


class WeatherBookingAgent(OutputAgentNode):
    """Agent that can check weather and book appointments."""
    
    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        
        # Appointments storage
        self.appointments = []
        
        # System prompt
        self.context.add_message({
            "role": "system",
            "content": """You are a helpful assistant that can:
1. Check the weather for any city
2. Book appointments for users
3. List upcoming appointments

Use the available tools when users ask about weather or appointments.
Be friendly and conversational."""
        })
    
    @function_tool()
    def get_weather(self, city: str) -> str:
        """Get the current weather for a city.
        
        Args:
            city: The city name to check weather for.
        """
        # Mock weather data (replace with real API)
        weather_data = {
            "new york": "Sunny, 72°F",
            "london": "Cloudy, 58°F",
            "tokyo": "Clear, 68°F",
            "paris": "Rainy, 55°F",
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
        appointment = {
            "date": date,
            "time": time,
            "service": service
        }
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
