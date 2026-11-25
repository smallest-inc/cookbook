// Captures mono float samples from the mic and posts them to the page. No network, no storage.
class Capture extends AudioWorkletProcessor {
	process(inputs) {
		const ch = inputs[0] && inputs[0][0];
		if (ch && ch.length) this.port.postMessage(new Float32Array(ch));
		return true;
	}
}
registerProcessor('capture', Capture);
