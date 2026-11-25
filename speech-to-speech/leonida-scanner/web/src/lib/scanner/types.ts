export type PlaceId = string;

export interface Place {
	name: string;
	x: number;
	y: number;
}

export interface Speaker {
	label: string;
	tag: string;
	home: PlaceId;
	mobile: boolean;
}

/** What the map and the 3D view show while a line airs. Built on the server (channels.scene_for). */
export interface Scene {
	unit: string;
	place: PlaceId;
	action: string;
	/** tell the live pilot about it */
	cue: boolean;
	/** a second unit that moves in the background without taking the camera */
	bg?: { unit: string; place: PlaceId; action: string };
}

export interface Line {
	i: number;
	speaker: string;
	text: string;
	place: PlaceId;
	at: PlaceId | null;
	gap: number;
	scene?: Scene;
}

export interface Channel {
	id: string;
	num: number;
	name: string;
	tagline: string;
	route: [number, number][];
	speakers: Record<string, Speaker>;
	lines: Line[];
	/** channel 6: one live Hydra voice instead of a loop of clips */
	live?: boolean;
}

export interface Beats {
	/** "channel:speaker" to unit id */
	speakers: Record<string, string>;
	/** "channel:line" to the place the runaway jet ski is at */
	jet: Record<string, PlaceId>;
	/** "channel:line" to a walker's move */
	person: Record<string, { unit: string; place: PlaceId; action: string }>;
}

export interface Marker {
	id: string;
	/** speaker id on a scripted channel, unit id on the live one */
	speaker: string;
	label: string;
	short: string;
	mobile: boolean;
	kind: string;
	x: number;
	y: number;
	active: boolean;
}

export interface ChannelsPayload {
	channels: Channel[];
	places: Record<PlaceId, Place>;
	player: { place: PlaceId; label: string };
	units: Record<string, { tag: string; label: string; kind: string; model: string; home: PlaceId }>;
	beats: Beats;
	sky?: SkyTable;
}

/** Sky Seven's airspace from sky.py: normalised keys, coordinates and names. */
export interface SkyTable {
	match: number;
	suggest: number;
	filler: string[];
	suffix: Record<string, string>;
	spots: Record<string, { name: string; x: number; y: number; kind: 'place' | 'street'; keys: string[] }>;
	units: Record<string, { name: string; keys: string[] }>;
}

export interface ReplyCall {
	speaker: string;
	text: string;
	place: PlaceId;
	scene?: Scene;
}

/** What the radio is doing right now. Named in words on the LCD and in the header. */
export type Phase = 'off' | 'booting' | 'tuning' | 'idle' | 'rx' | 'tx' | 'working' | 'error';

export interface Transmission {
	channelId: string;
	speaker: string;
	label: string;
	text: string;
	place: PlaceId | null;
	kind: 'loop' | 'reply' | 'you';
	startedAt: number;
	joinedMid: boolean;
	/** loop line key, so re-tuning into the same line does not log it twice */
	lineKey?: string;
}

export interface LogEntry {
	id: number;
	channelId: string;
	clock: string;
	label: string;
	text: string;
	place: PlaceId | null;
	kind: 'loop' | 'reply' | 'you';
}

export interface Timings {
	pulse: number;
	electron: number;
	lightning: number;
	source: string;
}
