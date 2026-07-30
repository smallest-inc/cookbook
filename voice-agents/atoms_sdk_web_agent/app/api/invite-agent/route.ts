import { NextResponse } from 'next/server';

export async function POST(req: Request) {
    try {
        const { searchParams } = new URL(req.url);
        const mode = searchParams.get('mode');

        const body = await req.json();

        let { agentId } = body;

        // Map frontend IDs to Environment Variable IDs
        if (agentId === 'tictactoe-agent') {
            agentId = process.env.TICTACTOE_AGENT_ID;
            console.log('[API] Mapped tictactoe-agent to:', agentId);
        } else if (agentId === 'hackernews-agent') {
            agentId = process.env.HACKERNEWS_AGENT_ID;
            console.log('[API] Mapped hackernews-agent to:', agentId);
        } else if (agentId === 'weather-agent' || !agentId) {
            // Default or Weather
            agentId = process.env.WEATHER_AGENT_ID;
        }

        const apiKey = process.env.SMALLESTAI_API_KEY;

        // Validate agentId
        if (!agentId || typeof agentId !== 'string' || agentId.trim() === '') {
            return NextResponse.json(
                { error: 'agentId is required and must be a non-empty string' },
                { status: 400 }
            );
        }

        // Validate apiKey
        if (!apiKey || typeof apiKey !== 'string' || apiKey.trim() === '') {
            console.error("Missing SMALLESTAI_API_KEY in server environment variables.");
            return NextResponse.json(
                { error: 'Server misconfiguration: API key missing' },
                { status: 500 }
            );
        }

        const payload = { agentId, synthesizer: { voice_id: "magnus", model: "waves_lightning_v3_1", provider: "smallest" } };

        console.log(`[API] Received request for mode: ${mode}`);
        console.log(`[API] Payload:`, { agentId, apiKeyLength: apiKey?.length });

        const upstreamUrl = `https://atoms-api.smallest.ai/api/v1/conversation/${mode}`;
        console.log(`[API] Forwarding to: ${upstreamUrl}`);

        const response = await fetch(
            upstreamUrl,
            {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${apiKey}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(payload),
            }
        );

        console.log(`[API] Upstream status: ${response.status} ${response.statusText}`);

        const data = await response.json();

        if (!response.ok) {
            console.error(`Error creating ${mode}:`, data || response.statusText);
            // Return detailed error to client for debugging
            return NextResponse.json({
                error: 'Upstream API error',
                details: data,
                status: response.status,
                upstreamUrl
            }, { status: response.status });
        }

        console.log(data);
        return NextResponse.json(data, { status: 201 });

    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        console.error(
            `Error creating conversation:`,
            errorMessage
        );
        return NextResponse.json(
            { error: `Failed to create conversation` },
            { status: 500 }
        );
    }
}
