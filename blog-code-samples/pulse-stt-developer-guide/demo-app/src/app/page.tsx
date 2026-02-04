'use client';

import { useState, useRef, useCallback } from 'react';

interface Word {
  word: string;
  start: number;
  end: number;
  speaker?: number;
  confidence?: number;
}

interface TranscriptionResult {
  status: string;
  transcription: string;
  words?: Word[];
  emotions?: Record<string, number>;
  age?: string;
  gender?: string;
  metadata?: {
    duration: number;
    fileSize: number;
  };
}

export default function Home() {
  const [activeTab, setActiveTab] = useState<'file' | 'realtime'>('file');
  
  // File upload state
  const [file, setFile] = useState<File | null>(null);
  const [language, setLanguage] = useState('en');
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [result, setResult] = useState<TranscriptionResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  // Real-time state
  const [isRecording, setIsRecording] = useState(false);
  const [realtimeTranscript, setRealtimeTranscript] = useState<string[]>([]);
  const [interimTranscript, setInterimTranscript] = useState('');
  const wsRef = useRef<WebSocket | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
      setResult(null);
      setError(null);
    }
  };

  const handleTranscribe = async () => {
    if (!file) return;

    setIsTranscribing(true);
    setError(null);
    setResult(null);

    try {
      const formData = new FormData();
      formData.append('audio', file);
      formData.append('language', language);

      const response = await fetch('/api/transcribe', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Transcription failed');
      }

      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsTranscribing(false);
    }
  };

  const startRecording = useCallback(async () => {
    try {
      setRealtimeTranscript([]);
      setInterimTranscript('');
      setError(null);

      // Get microphone access
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          sampleRate: 16000,
          echoCancellation: true,
          noiseSuppression: true,
        },
      });
      streamRef.current = stream;

      // Connect to WebSocket proxy server
      const wsUrl = `ws://localhost:3001?language=${language}&sample_rate=16000`;
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log('✅ Connected to WebSocket proxy');
        setIsRecording(true);
        
        // Set up audio processing - use browser's native sample rate
        audioContextRef.current = new AudioContext();
        const actualSampleRate = audioContextRef.current.sampleRate;
        console.log(`🎤 Audio sample rate: ${actualSampleRate}Hz`);
        
        const source = audioContextRef.current.createMediaStreamSource(stream);
        processorRef.current = audioContextRef.current.createScriptProcessor(4096, 1, 1);

        processorRef.current.onaudioprocess = (e) => {
          if (ws.readyState === WebSocket.OPEN) {
            const input = e.inputBuffer.getChannelData(0);
            
            // Resample to 16kHz using linear interpolation
            let resampled: Float32Array;
            if (actualSampleRate !== 16000) {
              const ratio = actualSampleRate / 16000;
              const newLength = Math.round(input.length / ratio);
              resampled = new Float32Array(newLength);
              for (let i = 0; i < newLength; i++) {
                const srcIndex = i * ratio;
                const srcIndexFloor = Math.floor(srcIndex);
                const srcIndexCeil = Math.min(srcIndexFloor + 1, input.length - 1);
                const fraction = srcIndex - srcIndexFloor;
                resampled[i] = input[srcIndexFloor] * (1 - fraction) + input[srcIndexCeil] * fraction;
              }
            } else {
              resampled = input;
            }
            
            // Convert Float32 to Int16 PCM
            const outputData = new Int16Array(resampled.length);
            for (let i = 0; i < resampled.length; i++) {
              const s = Math.max(-1, Math.min(1, resampled[i]));
              outputData[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
            }
            
            ws.send(outputData.buffer);
          }
        };

        source.connect(processorRef.current);
        processorRef.current.connect(audioContextRef.current.destination);
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          
          // Handle connection status messages
          if (data.type === 'connected') {
            console.log('🎙️ Ready to transcribe');
            return;
          }
          if (data.type === 'error') {
            setError(data.message);
            return;
          }
          if (data.type === 'disconnected') {
            console.log('🔌 Disconnected from STT');
            return;
          }
          
          // Handle transcription results
          if (data.transcript) {
            if (data.is_final) {
              setRealtimeTranscript(prev => [...prev, data.transcript]);
              setInterimTranscript('');
            } else {
              setInterimTranscript(data.transcript);
            }
          }
        } catch (e) {
          console.error('Parse error:', e);
        }
      };

      ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        setError('WebSocket connection failed. Make sure the proxy server is running: node ws-server.js');
        stopRecording();
      };
      
      ws.onclose = () => {
        console.log('🔌 WebSocket closed');
        setIsRecording(false);
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      if (message.includes('Permission') || message.includes('denied') || message.includes('not allowed')) {
        setError('Microphone access denied. Please open this page in Chrome/Safari and allow microphone permission.');
      } else {
        setError(message);
      }
    }
  }, [language]);

  const stopRecording = useCallback(() => {
    setIsRecording(false);

    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }

    if (processorRef.current) {
      processorRef.current.disconnect();
      processorRef.current = null;
    }

    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
  }, []);

  const languages = [
    { code: 'en', name: 'English' },
    { code: 'hi', name: 'Hindi' },
    { code: 'es', name: 'Spanish' },
    { code: 'fr', name: 'French' },
    { code: 'de', name: 'German' },
    { code: 'pt', name: 'Portuguese' },
    { code: 'multi', name: 'Auto-detect' },
  ];

  return (
    <main className="min-h-screen bg-[#092023]">
      <div className="container mx-auto px-4 py-12 max-w-4xl">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl md:text-5xl font-bold text-[#FBFAF5] mb-4">
            🎙️ Pulse STT Demo
          </h1>
          <p className="text-[#43B6B6] text-lg">
            Speech-to-Text powered by Smallest AI
          </p>
        </div>

        {/* Tab Navigation */}
        <div className="flex justify-center mb-8">
          <div className="bg-[#1D4E52] rounded-xl p-1">
            <button
              onClick={() => setActiveTab('file')}
              className={`px-6 py-3 rounded-lg font-medium transition-all ${
                activeTab === 'file'
                  ? 'bg-[#43B6B6] text-[#092023] shadow-lg'
                  : 'text-[#FBFAF5]/70 hover:text-[#FBFAF5]'
              }`}
            >
              📁 File Upload
            </button>
            <button
              onClick={() => setActiveTab('realtime')}
              className={`px-6 py-3 rounded-lg font-medium transition-all ${
                activeTab === 'realtime'
                  ? 'bg-[#43B6B6] text-[#092023] shadow-lg'
                  : 'text-[#FBFAF5]/70 hover:text-[#FBFAF5]'
              }`}
            >
              🎤 Real-time
            </button>
          </div>
        </div>

        {/* Content Card */}
        <div className="bg-[#1D4E52] rounded-2xl p-8 shadow-2xl border border-[#43B6B6]/20">
          {activeTab === 'file' ? (
            /* File Upload Tab */
            <div className="space-y-6">
              {/* File Input */}
              <div>
                <label className="block text-[#43B6B6] text-sm font-medium mb-2">
                  Audio File
                </label>
                <div className="relative">
                  <input
                    type="file"
                    accept="audio/*"
                    onChange={handleFileChange}
                    className="block w-full text-sm text-[#FBFAF5]/70
                      file:mr-4 file:py-3 file:px-6
                      file:rounded-lg file:border-0
                      file:text-sm file:font-medium
                      file:bg-[#43B6B6] file:text-[#092023]
                      hover:file:bg-[#3aa3a3]
                      file:cursor-pointer cursor-pointer
                      bg-[#092023] rounded-lg border border-[#43B6B6]/30"
                  />
                </div>
                {file && (
                  <p className="mt-2 text-sm text-[#43B6B6]">
                    Selected: {file.name} ({(file.size / 1024).toFixed(1)} KB)
                  </p>
                )}
              </div>

              {/* Language Select */}
              <div>
                <label className="block text-[#43B6B6] text-sm font-medium mb-2">
                  Language
                </label>
                <select
                  value={language}
                  onChange={(e) => setLanguage(e.target.value)}
                  className="w-full bg-[#092023] border border-[#43B6B6]/30 text-[#FBFAF5] rounded-lg px-4 py-3 focus:ring-2 focus:ring-[#43B6B6] focus:border-transparent"
                >
                  {languages.map((lang) => (
                    <option key={lang.code} value={lang.code}>
                      {lang.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Transcribe Button */}
              <button
                onClick={handleTranscribe}
                disabled={!file || isTranscribing}
                className="w-full bg-[#FFCF72] text-[#092023] font-semibold py-4 px-6 rounded-xl
                  hover:bg-[#ffc94d] disabled:opacity-50 disabled:cursor-not-allowed
                  transition-all transform hover:scale-[1.02] active:scale-[0.98]"
              >
                {isTranscribing ? (
                  <span className="flex items-center justify-center">
                    <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-[#092023]" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Transcribing...
                  </span>
                ) : (
                  '📝 Transcribe'
                )}
              </button>

              {/* Error Display */}
              {error && (
                <div className="bg-[#FF5E5E]/20 border border-[#FF5E5E] text-[#FF5E5E] rounded-lg p-4">
                  {error}
                </div>
              )}

              {/* Results */}
              {result && (
                <div className="space-y-6 mt-8">
                  {/* Transcription */}
                  <div>
                    <h3 className="text-lg font-medium text-[#FBFAF5] mb-3">📝 Transcription</h3>
                    <div className="bg-[#092023] rounded-lg p-4 text-[#FBFAF5]/90 border border-[#43B6B6]/20">
                      {result.transcription}
                    </div>
                  </div>

                  {/* Word Timestamps */}
                  {result.words && result.words.length > 0 && (
                    <div>
                      <h3 className="text-lg font-medium text-[#FBFAF5] mb-3">⏱️ Word Timestamps</h3>
                      <div className="bg-[#092023] rounded-lg p-4 flex flex-wrap gap-2 border border-[#43B6B6]/20">
                        {result.words.map((word, i) => (
                          <span
                            key={i}
                            className="inline-block bg-[#43B6B6]/20 text-[#43B6B6] px-2 py-1 rounded text-sm cursor-help hover:bg-[#43B6B6]/30 transition-colors"
                            title={`${word.start.toFixed(2)}s - ${word.end.toFixed(2)}s${word.speaker !== undefined ? ` | Speaker ${word.speaker}` : ''}`}
                          >
                            {word.word}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Emotions */}
                  {result.emotions && Object.keys(result.emotions).length > 0 && (
                    <div>
                      <h3 className="text-lg font-medium text-[#FBFAF5] mb-3">😊 Emotions</h3>
                      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                        {Object.entries(result.emotions).map(([emotion, score]) => (
                          <div key={emotion} className="bg-[#092023] rounded-lg p-3 text-center border border-[#43B6B6]/20">
                            <div className="text-2xl mb-1">
                              {emotion === 'happiness' && '😊'}
                              {emotion === 'sadness' && '😢'}
                              {emotion === 'anger' && '😠'}
                              {emotion === 'fear' && '😨'}
                              {emotion === 'disgust' && '🤢'}
                            </div>
                            <div className="text-xs text-[#FBFAF5]/50 capitalize">{emotion}</div>
                            <div className="text-sm font-medium text-[#FFCF72]">{(score * 100).toFixed(0)}%</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Metadata */}
                  <div className="flex flex-wrap gap-4 text-sm">
                    {result.age && (
                      <span className="bg-[#092023] px-3 py-1 rounded-full text-[#43B6B6] border border-[#43B6B6]/30">
                        Age: {result.age}
                      </span>
                    )}
                    {result.gender && (
                      <span className="bg-[#092023] px-3 py-1 rounded-full text-[#43B6B6] border border-[#43B6B6]/30">
                        Gender: {result.gender}
                      </span>
                    )}
                    {result.metadata?.duration && (
                      <span className="bg-[#092023] px-3 py-1 rounded-full text-[#43B6B6] border border-[#43B6B6]/30">
                        Duration: {result.metadata.duration.toFixed(2)}s
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>
          ) : (
            /* Real-time Tab */
            <div className="space-y-6">
              {/* Language Select */}
              <div>
                <label className="block text-[#43B6B6] text-sm font-medium mb-2">
                  Language
                </label>
                <select
                  value={language}
                  onChange={(e) => setLanguage(e.target.value)}
                  disabled={isRecording}
                  className="w-full bg-[#092023] border border-[#43B6B6]/30 text-[#FBFAF5] rounded-lg px-4 py-3 focus:ring-2 focus:ring-[#43B6B6] focus:border-transparent disabled:opacity-50"
                >
                  {languages.map((lang) => (
                    <option key={lang.code} value={lang.code}>
                      {lang.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Record Button */}
              <button
                onClick={isRecording ? stopRecording : startRecording}
                className={`w-full font-semibold py-4 px-6 rounded-xl transition-all transform hover:scale-[1.02] active:scale-[0.98] ${
                  isRecording
                    ? 'bg-[#FF5E5E] hover:bg-[#e85555] text-white'
                    : 'bg-[#FFCF72] hover:bg-[#ffc94d] text-[#092023]'
                }`}
              >
                {isRecording ? (
                  <span className="flex items-center justify-center">
                    <span className="w-3 h-3 bg-white rounded-full mr-3 animate-pulse"></span>
                    Stop Recording
                  </span>
                ) : (
                  '🎤 Start Recording'
                )}
              </button>

              {/* Error Display */}
              {error && (
                <div className="bg-[#FFCF72]/20 border border-[#FFCF72] text-[#FFCF72] rounded-lg p-4">
                  <strong>Note:</strong> {error}
                </div>
              )}

              {/* Real-time Transcript */}
              <div>
                <h3 className="text-lg font-medium text-[#FBFAF5] mb-3">📝 Live Transcript</h3>
                <div className="bg-[#092023] rounded-lg p-4 min-h-[200px] text-[#FBFAF5]/90 border border-[#43B6B6]/20">
                  {realtimeTranscript.map((text, i) => (
                    <p key={i} className="mb-2">{text}</p>
                  ))}
                  {interimTranscript && (
                    <p className="text-[#43B6B6] italic">{interimTranscript}...</p>
                  )}
                  {!isRecording && realtimeTranscript.length === 0 && !interimTranscript && (
                    <p className="text-[#FBFAF5]/40 italic">Click &quot;Start Recording&quot; to begin...</p>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="text-center mt-8 text-[#FBFAF5]/60 text-sm">
          <p>
            Powered by{' '}
            <a href="https://smallest.ai" target="_blank" rel="noopener noreferrer" className="text-[#43B6B6] hover:text-[#FFCF72] transition-colors">
              Smallest AI
            </a>
            {' '}•{' '}
            <a href="https://waves-docs.smallest.ai" target="_blank" rel="noopener noreferrer" className="text-[#43B6B6] hover:text-[#FFCF72] transition-colors">
              Documentation
            </a>
          </p>
        </div>
      </div>
    </main>
  );
}
