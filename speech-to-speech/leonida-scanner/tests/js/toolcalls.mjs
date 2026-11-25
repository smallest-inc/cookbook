// Runs the tool-call panel formatter (web/src/lib/scanner/toolcalls.ts). Used by tests/test_toolcalls.py.
import { describeArgs, describeResult, pushCall, sessionClock } from '../../web/src/lib/scanner/toolcalls.ts';

let list = [];
for (let i = 1; i <= 10; i++) list = pushCall(list, { id: i, via: 'tool', name: 'fly_to', args: '{}', result: 'ok', ok: true, clock: '0:00' });
const out = {
	args: [describeArgs({ place: 'Ocean Drive' }), describeArgs(undefined), describeArgs({ place: 'x'.repeat(200) }).length],
	unknown: describeResult({ ok: false, heard: 'ocean drive', error: 'unknown place', suggest: 'Seagrape Expressway', suggest_id: 'seagrape' }),
	moved: describeResult({ ok: true, place: 'Coquina Row', eta_s: 6, action: 'heading to' }),
	report: describeResult({ ok: true, over: 'Mango Heights', heading_to: '', following: '', spotlight: 'on', below: [] }),
	bare: describeResult({ ok: false }),
	clocks: [sessionClock(0), sessionClock(65_400), sessionClock(-5)],
	order: list.map((e) => e.id)
};
process.stdout.write(JSON.stringify(out));
