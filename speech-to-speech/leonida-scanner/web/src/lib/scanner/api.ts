import type { ChannelsPayload, ReplyCall } from './types.js';

async function fail(res: Response, what: string): Promise<never> {
	const data = (await res.json().catch(() => ({}))) as { error?: string };
	throw new Error(data.error ? `${what}: ${data.error}` : `${what} failed (${res.status})`);
}

export async function getChannels(): Promise<ChannelsPayload> {
	const res = await fetch('/api/channels');
	if (!res.ok) return fail(res, 'Channel list');
	return res.json();
}

export async function getLine(channelId: string, i: number): Promise<ArrayBuffer> {
	const res = await fetch(`/api/line?ch=${encodeURIComponent(channelId)}&i=${i}`);
	if (!res.ok) return fail(res, 'Lightning');
	return res.arrayBuffer();
}

export async function tts(channel: string, speaker: string, text: string): Promise<ArrayBuffer> {
	const res = await fetch('/api/tts', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ channel, speaker, text })
	});
	if (!res.ok) return fail(res, 'Lightning');
	return res.arrayBuffer();
}

export async function stt(wav: ArrayBuffer): Promise<string> {
	const res = await fetch('/api/stt', {
		method: 'POST',
		headers: { 'Content-Type': 'application/octet-stream' },
		body: wav
	});
	if (!res.ok) return fail(res, 'Pulse');
	const data = (await res.json()) as { transcription?: string };
	return (data.transcription ?? '').trim();
}

export async function reply(
	channel: string,
	transcript: string,
	history: string[]
): Promise<{ calls: ReplyCall[]; source: string }> {
	const res = await fetch('/api/reply', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ channel, transcript, history })
	});
	if (!res.ok) return fail(res, 'Electron');
	return res.json();
}

export async function liveStatus(): Promise<{ available: boolean; byok?: boolean; max_session_s: number }> {
	const res = await fetch('/api/live/status');
	if (!res.ok) return { available: false, max_session_s: 300 };
	return res.json();
}
