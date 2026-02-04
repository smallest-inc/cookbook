/**
 * WebSocket Proxy Server for Pulse STT
 * 
 * This proxy keeps your API key secure on the server while allowing
 * browser clients to stream audio for real-time transcription.
 * 
 * Run: node ws-proxy.js
 */

const WebSocket = require('ws');
const http = require('http');
require('dotenv').config({ path: '.env.local' });

const PORT = 3001;
const API_KEY = process.env.SMALLEST_API_KEY;

if (!API_KEY) {
  console.error('❌ SMALLEST_API_KEY not found in .env.local');
  process.exit(1);
}

// Create HTTP server
const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('WebSocket Proxy Server for Pulse STT');
});

// Create WebSocket server
const wss = new WebSocket.Server({ server });

wss.on('connection', (clientWs, req) => {
  console.log('🔌 Client connected');
  
  // Parse query params from client connection
  const url = new URL(req.url, `http://localhost:${PORT}`);
  const language = url.searchParams.get('language') || 'en';
  
  // Build Pulse STT WebSocket URL
  const params = new URLSearchParams({
    language: language,
    encoding: 'linear16',
    sample_rate: '16000',
    word_timestamps: 'true',
    full_transcript: 'true'
  });
  
  const pulseUrl = `wss://waves-api.smallest.ai/api/v1/pulse/get_text?${params}`;
  
  // Connect to Pulse STT
  const pulseWs = new WebSocket(pulseUrl, {
    headers: { 
      'Authorization': `Bearer ${API_KEY}` 
    }
  });
  
  pulseWs.on('open', () => {
    console.log('✅ Connected to Pulse STT');
    clientWs.send(JSON.stringify({ type: 'connected', message: 'Ready for audio' }));
  });
  
  pulseWs.on('message', (data) => {
    // Forward transcription to client
    try {
      const message = JSON.parse(data.toString());
      console.log('📝 Transcript:', message.transcript?.substring(0, 50) || '(partial)');
      clientWs.send(data.toString());
    } catch (e) {
      clientWs.send(data.toString());
    }
  });
  
  pulseWs.on('error', (error) => {
    console.error('❌ Pulse STT error:', error.message);
    clientWs.send(JSON.stringify({ 
      type: 'error', 
      message: error.message 
    }));
  });
  
  pulseWs.on('close', (code, reason) => {
    console.log(`🔌 Pulse STT closed: ${code} - ${reason}`);
    clientWs.send(JSON.stringify({ 
      type: 'closed', 
      code, 
      reason: reason.toString() 
    }));
  });
  
  // Forward audio from client to Pulse
  clientWs.on('message', (data) => {
    if (pulseWs.readyState === WebSocket.OPEN) {
      // Check if it's binary audio data or JSON control message
      if (Buffer.isBuffer(data) || data instanceof ArrayBuffer) {
        pulseWs.send(data);
      } else {
        try {
          const msg = JSON.parse(data.toString());
          if (msg.type === 'end') {
            pulseWs.send(JSON.stringify({ type: 'end' }));
          }
        } catch (e) {
          // Binary data, forward as-is
          pulseWs.send(data);
        }
      }
    }
  });
  
  clientWs.on('close', () => {
    console.log('🔌 Client disconnected');
    if (pulseWs.readyState === WebSocket.OPEN) {
      pulseWs.close();
    }
  });
  
  clientWs.on('error', (error) => {
    console.error('❌ Client error:', error.message);
  });
});

server.listen(PORT, () => {
  console.log(`
🎙️  Pulse STT WebSocket Proxy
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   Proxy:    ws://localhost:${PORT}
   Status:   Ready
   
   Connect your browser to this proxy.
   Audio will be forwarded to Pulse STT.
`);
});
