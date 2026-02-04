/**
 * Browser-based Real-time ASR with Microphone
 *
 * This script captures microphone audio and streams it to Pulse STT.
 * Include this in your HTML page.
 *
 * Note: In browsers, WebSocket doesn't support custom headers.
 * Use a backend proxy (see demo-app/server.ts) for secure API key handling.
 *
 * Usage in HTML:
 *   <script src="browser_client.js"></script>
 *   <button onclick="startASR()">Start</button>
 *   <button onclick="stopASR()">Stop</button>
 *   <div id="transcription"></div>
 *   <div id="interim"></div>
 *   <div id="status"></div>
 */

let ws;
let audioContext;
let processor;
let source;
let stream;

/**
 * Start real-time transcription
 * @param {string} wsUrl - WebSocket URL (use your backend proxy URL)
 */
async function startASR(wsUrl = 'ws://localhost:3000/ws/transcribe?language=en') {
  ws = new WebSocket(wsUrl);

  ws.onopen = async () => {
    console.log('✅ Connected to ASR service');
    updateStatus('Connected');
    await setupMicrophone();
  };

  ws.onmessage = (event) => {
    try {
      const response = JSON.parse(event.data);
      handleTranscription(response);
    } catch (err) {
      console.error('❌ Parse error:', err);
    }
  };

  ws.onerror = (error) => {
    console.error('❌ WebSocket error:', error);
    updateStatus('Error');
  };

  ws.onclose = (event) => {
    console.log(`🔌 Connection closed: ${event.code} - ${event.reason}`);
    stopASR();
  };
}

async function setupMicrophone() {
  try {
    // Request microphone access
    stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        channelCount: 1,
        sampleRate: 16000,
        echoCancellation: true,
        noiseSuppression: true
      }
    });

    // Create audio processing pipeline
    audioContext = new AudioContext({ sampleRate: 16000 });
    source = audioContext.createMediaStreamSource(stream);

    // ScriptProcessorNode for capturing raw PCM
    processor = audioContext.createScriptProcessor(4096, 1, 1);

    processor.onaudioprocess = (event) => {
      if (ws && ws.readyState === WebSocket.OPEN) {
        const inputData = event.inputBuffer.getChannelData(0);

        // Convert Float32 to Int16 PCM
        const pcmData = new Int16Array(inputData.length);
        for (let i = 0; i < inputData.length; i++) {
          const s = Math.max(-1, Math.min(1, inputData[i]));
          pcmData[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
        }

        ws.send(pcmData.buffer);
      }
    };

    source.connect(processor);
    processor.connect(audioContext.destination);

    updateStatus('🎤 Listening...');

  } catch (err) {
    console.error('❌ Microphone error:', err);
    alert('Microphone access required for ASR functionality');
  }
}

function handleTranscription(response) {
  if (response.status === 'error') {
    console.error('❌ API Error:', response.message);
    return;
  }

  if (response.transcript) {
    const isFinal = response.is_final;

    if (isFinal) {
      // Final transcription - append to results
      appendFinalTranscript(response.transcript);
    } else {
      // Partial - update interim display
      updateInterimTranscript(response.transcript);
    }
  }
}

function appendFinalTranscript(text) {
  const container = document.getElementById('transcription');
  if (container) {
    const div = document.createElement('div');
    div.className = 'final-transcript';
    div.textContent = text;
    container.appendChild(div);
  }

  // Clear interim
  const interim = document.getElementById('interim');
  if (interim) {
    interim.textContent = '';
  }
}

function updateInterimTranscript(text) {
  const interim = document.getElementById('interim');
  if (interim) {
    interim.textContent = text;
  }
}

function updateStatus(message) {
  const status = document.getElementById('status');
  if (status) {
    status.textContent = message;
  }
  console.log('Status:', message);
}

function stopASR() {
  if (processor) {
    processor.disconnect();
    processor = null;
  }
  if (source) {
    source.disconnect();
    source = null;
  }
  if (audioContext) {
    audioContext.close();
    audioContext = null;
  }
  if (stream) {
    stream.getTracks().forEach(track => track.stop());
    stream = null;
  }
  if (ws) {
    ws.close();
    ws = null;
  }

  updateStatus('⏹️ Stopped');
}

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { startASR, stopASR };
}
