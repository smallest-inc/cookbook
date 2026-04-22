// Float32 linear PCM in [-1, 1] -> 0..1 RMS. Used for waveform bars.
export function rmsFloat32(samples: Float32Array): number {
  if (samples.length === 0) return 0;
  let sum = 0;
  for (let i = 0; i < samples.length; i++) {
    const s = samples[i];
    sum += s * s;
  }
  return Math.sqrt(sum / samples.length);
}

// Int16 LE PCM -> 0..1 RMS for the agent-audio side.
export function rmsInt16(bytes: Uint8Array): number {
  const count = bytes.length >> 1;
  if (count === 0) return 0;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let sum = 0;
  for (let i = 0; i < count; i++) {
    const s = view.getInt16(i * 2, true) / 32768;
    sum += s * s;
  }
  return Math.sqrt(sum / count);
}
