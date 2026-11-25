/**
 * Port Ibis: an original, fictional sun-belt coastal city drawn for this demo.
 * Map space is 1200 x 900. Land and water extend past the edges so any crop looks continuous.
 * Not traced from, or based on, any real or game map.
 */

export const W = 1200;
export const H = 900;

export const mainland =
	'M-500,-400 L828,-400 L828,0 C836,40 818,80 826,120 L832,200 C812,240 822,300 812,350 C806,390 818,410 812,440 C804,480 814,520 806,545 L806,605 C812,640 796,700 804,760 C810,820 796,860 808,900 L808,1300 L-500,1300 Z';

export const ocean =
	'M1000,-400 L1700,-400 L1700,1300 L1064,1300 L1064,900 L1050,836 L1040,790 L1034,700 L1028,560 L1022,420 L1016,280 L1006,140 L996,40 Z';

export const islandNorth =
	'M958,36 C975,22 992,26 998,44 C1010,160 1018,320 1024,480 C1030,620 1036,720 1040,790 L1004,796 C996,700 990,580 984,480 C976,330 968,180 958,36 Z';
export const islandSouth = 'M1012,842 L1050,836 C1056,860 1062,880 1064,900 L1064,1300 L1020,1300 Z';
export const beachNorth = 'M998,44 C1010,160 1018,320 1024,480 C1030,620 1036,720 1040,790';
export const beachSouth = 'M1050,836 C1056,860 1062,880 1064,900 L1064,1300';

export const marinaBasin = 'M806,540 L744,540 L744,606 L806,606 Z';
export const marinaPiers = [
	[752, 552, 40],
	[752, 566, 40],
	[752, 580, 40],
	[752, 594, 40]
] as const;

export const swamp =
	'M-500,-400 L210,-400 L210,0 C250,60 205,130 240,190 C270,250 222,300 256,360 C286,430 238,480 268,540 C290,590 250,620 230,650 L-500,650 Z';
export const swampChannels = [
	'M200,20 C160,70 190,120 140,160 S80,240 110,300 S60,380 20,420',
	'M240,250 C200,270 170,240 130,270 S70,300 30,280',
	'M250,470 C210,500 180,470 150,510 S90,560 40,540',
	'M120,560 C90,600 60,590 20,620'
];
export const ponds = [
	[70, 110, 26, 14],
	[180, 330, 18, 10],
	[60, 470, 30, 12],
	[150, 600, 22, 9]
] as const;

export const river = 'M235,575 C300,548 350,608 420,580 S520,548 580,588 S690,602 746,574';

export const expressway =
	'M446,-400 L446,0 C452,120 452,200 462,300 C472,420 482,520 476,620 C472,720 470,800 466,900 L466,1300';
export const swampRoad = 'M458,300 C380,320 320,302 262,352 S150,402 40,384 L-500,384';
export const islandRoad = 'M978,64 C990,200 1000,400 1008,560 C1014,680 1018,740 1022,790';
export const causewayLand = 'M462,440 L812,440';
export const causewayBridge = 'M812,440 C860,436 940,428 992,428';
export const arterials = [
	'M250,240 L832,240', // Conch Ave
	'M250,620 L806,620', // Tarpon Blvd
	'M110,760 L806,760', // Marlin Pkwy
	'M540,-400 L540,1300', // Hibiscus St
	'M790,200 L790,880' // Mangrove Ave
];

function grid(x0: number, y0: number, cols: number, rows: number, w: number, h: number, gx: number, gy: number) {
	const out: { x: number; y: number; w: number; h: number; k: number }[] = [];
	for (let r = 0; r < rows; r += 1)
		for (let c = 0; c < cols; c += 1) out.push({ x: x0 + c * (w + gx), y: y0 + r * (h + gy), w, h, k: (r * 7 + c * 3) % 5 });
	return out;
}

// Coral Court downtown: dense grid with a park and a few towers
export const downtownArea = { x: 548, y: 252, w: 230, h: 252 };
export const downtown = grid(552, 256, 5, 6, 34, 30, 10, 12).filter(
	(b) => !(b.x >= 630 && b.x <= 690 && b.y >= 380 && b.y <= 440)
);
export const banyanPark = { x: 640, y: 382, w: 78, h: 72 };

// Mango Heights: small suburban blocks, slightly turned
export const suburbArea = { x: 286, y: 262, w: 156, h: 236 };
export const suburb = grid(292, 268, 5, 9, 22, 16, 8, 10);

// Coquina Row: south residential
export const southArea = { x: 520, y: 642, w: 272, h: 222 };
export const south = grid(526, 648, 5, 6, 42, 24, 10, 12).filter((b) => !(b.y > 740 && b.y < 770));

// Old Quay: port and containers
export const quayArea = { x: 600, y: 20, w: 226, h: 186 };
export const containers = grid(616, 40, 6, 7, 24, 10, 8, 12);
export const quayPiers = [
	[826, 46, 58],
	[826, 96, 58],
	[826, 146, 46]
] as const;

// Ibis Field airport
export const airport = { x: 110, y: 668, w: 300, h: 196 };
export const runways = [
	{ x: 130, y: 760, w: 262, h: 18, rot: -10, cx: 261, cy: 769 },
	{ x: 170, y: 702, w: 190, h: 13, rot: 22, cx: 265, cy: 708 }
];
export const terminal = { x: 300, y: 820, w: 90, h: 26 };

// Orange groves north of the toll: rows of dots
export const groves = Array.from({ length: 10 * 6 }, (_, i) => ({
	x: 300 + (i % 10) * 14,
	y: 60 + Math.floor(i / 10) * 14
}));

export const districtLabels = [
	{ text: 'Sawgrass Reach', x: 110, y: 214 },
	{ text: 'Gator Flats', x: 150, y: 430 },
	{ text: 'Mango Heights', x: 364, y: 254 },
	{ text: 'Coral Court', x: 662, y: 242 },
	{ text: 'Old Quay', x: 712, y: 112 },
	{ text: 'Ibis Field', x: 258, y: 656 },
	{ text: 'Coquina Row', x: 656, y: 636 },
	{ text: 'Cypress groves', x: 362, y: 44 }
];
export const waterLabels = [
	{ text: 'Heron Bay', x: 905, y: 300 },
	{ text: 'Open water', x: 1120, y: 470 },
	{ text: 'Tarpon River', x: 360, y: 610 }
];
export const roadLabels = [
	{ text: 'Seagrape Expy', x: 484, y: 470, rot: 86 },
	{ text: 'Palm Causeway', x: 900, y: 420, rot: -3 },
	{ text: 'Conch Ave', x: 300, y: 234, rot: 0 },
	{ text: 'Marlin Pkwy', x: 470, y: 754, rot: 0 },
	{ text: 'Flamingo Strip', x: 1020, y: 640, rot: 86 }
];
