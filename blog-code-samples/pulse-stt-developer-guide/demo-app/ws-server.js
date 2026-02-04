/**
 * WebSocket Proxy Server for Pulse STT
 * 
 * This server acts as a secure proxy between the browser and Smallest AI's
 * WebSocket STT endpoint, keeping your API key server-side.
 */

import { WebSocketServer, WebSocket } from 'ws';
import { createServer } from 'http';
import { parse } from 'url';

const WS_PORT = 3001;
// Pulse STT WebSocket endpoint (official v4.0.0 endpoint)
const PULSE_WS_URL = 'wss://waves-api.smallest.ai/api/v1/pulse/get_text';

// Get API key from environment
const API_KEY = process.env.SMALLEST_API_KEY;

if (!API_KEY) {
  console.error('❌ SMALLEST_API_KEY environment variable is required');
  process.exit(1);
}

// Create HTTP server for WebSocket upgrade
const server = createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('Pulse STT WebSocket Proxy Server');
});

// Create WebSocket server
const wss = new WebSocketServer({ server });

wss.on('connection', (clientWs, req) => {
  console.log('🔌 Client connected');
  
  // Parse query parameters from client
  const queryParams = parse(req.url, true).query;
  const language = queryParams.language || 'en';
  const sampleRate = queryParams.sample_rate || '16000';
  
  // Build Lightning STT WebSocket URL with parameters
  const pulseParams = new URLSearchParams({
    language: language,
    sample_rate: sampleRate,
    encoding: 'linear16',
    word_timestamps: 'true',
    full_transcript: 'true',
    numerals: 'auto'
  });
  
  const pulseUrl = `${PULSE_WS_URL}?${pulseParams}`;
  console.log(`📡 Connecting to Pulse STT: ${pulseUrl}`);
  
  // Connect to Pulse STT WebSocket
  const pulseWs = new WebSocket(pulseUrl, {
    headers: {
      'Authorization': `Bearer ${API_KEY}`
    }
  });
  
  pulseWs.on('open', () => {
    console.log('✅ Connected to Pulse STT');
    clientWs.send(JSON.stringify({ type: 'connected', message: 'Ready to transcribe' }));
  });
  
  pulseWs.on('message', (data) => {
    // Forward transcription results to client
    const msgStr = data.toString();
    console.log('📩 Received from Pulse STT:', msgStr.substring(0, 200));
    try {
      const message = JSON.parse(msgStr);
      clientWs.send(JSON.stringify(message));
    } catch (e) {
      clientWs.send(msgStr);
    }
  });
  
  pulseWs.on('error', (error) => {
    console.error('❌ Pulse STT error:', error.message);
    clientWs.send(JSON.stringify({ 
      type: 'error', 
      message: `STT connection error: ${error.message}` 
    }));
  });
  
  pulseWs.on('close', (code, reason) => {
    console.log(`🔌 Pulse STT disconnected: ${code} - ${reason}`);
    clientWs.send(JSON.stringify({ type: 'disconnected' }));
  });
  
  // Forward audio data from client to Pulse STT
  let audioChunkCount = 0;
  clientWs.on('message', (data) => {
    if (pulseWs.readyState === WebSocket.OPEN) {
      // Check if it's a control message (JSON) or audio data (binary)
      if (Buffer.isBuffer(data) || data instanceof ArrayBuffer) {
        audioChunkCount++;
        if (audioChunkCount % 50 === 1) {
          console.log(`🎵 Sending audio chunk #${audioChunkCount}, size: ${data.length} bytes`);
        }
        pulseWs.send(data);
      } else {
        try {
          const message = JSON.parse(data.toString());
          console.log('📤 Control message:', message);
          if (message.type === 'end') {
            // Signal end of audio stream
            pulseWs.send(JSON.stringify({ type: 'end' }));
          }
        } catch (e) {
          // Not JSON, treat as audio data
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
    console.error('❌ Client WebSocket error:', error.message);
  });
});

server.listen(WS_PORT, () => {
  console.log(`\n🎙️  Pulse STT WebSocket Proxy`);
  console.log(`   Running on ws://localhost:${WS_PORT}`);
  console.log(`   API Key: ${API_KEY.slice(0, 8)}...${API_KEY.slice(-4)}\n`);
});
