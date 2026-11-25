// Runs the browser matcher (web/src/lib/scanner/sky.ts) on cases from stdin. Used by tests/test_sky.py.
import { readFileSync } from 'node:fs';
import { Sky, ratio } from '../../web/src/lib/scanner/sky.ts';

const input = JSON.parse(readFileSync(0, 'utf8'));
const sky = new Sky(input.table);
const out = {
	places: input.places.map(([h, near]) => sky.resolvePlace(h, near)),
	units: input.units.map((h) => sky.resolveUnit(h)),
	speech: input.speech.map((t) => sky.intentFromSpeech(t)),
	calls: input.calls.map(([n, a, near]) => sky.meaning(n, a, near)),
	ratios: input.ratios.map(([a, b]) => ratio(a, b))
};
process.stdout.write(JSON.stringify(out));
