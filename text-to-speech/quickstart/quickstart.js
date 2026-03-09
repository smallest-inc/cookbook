const fs = require("fs");

const apiKey = process.env.SMALLEST_API_KEY;
if (!apiKey) {
  console.error("Error: set SMALLEST_API_KEY environment variable");
  console.error("Get your key at https://app.smallest.ai/dashboard/settings/apikeys");
  process.exit(1);
}

fetch("https://api.smallest.ai/waves/v1/lightning-v3.1/get_speech", {
  method: "POST",
  headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
  body: JSON.stringify({ text: "Hello! Welcome to Smallest AI. This is your first text-to-speech generation.", voice_id: "sophia", sample_rate: 24000, output_format: "wav" }),
})
  .then((r) => {
    if (!r.ok) return r.text().then((t) => { throw new Error(`API error (${r.status}): ${t}`); });
    return r.arrayBuffer();
  })
  .then((buf) => {
    fs.writeFileSync("output.wav", Buffer.from(buf));
    console.log(`Done! Saved output.wav (${Buffer.from(buf).length.toLocaleString()} bytes)`);
  })
  .catch((err) => { console.error(err.message); process.exit(1); });
