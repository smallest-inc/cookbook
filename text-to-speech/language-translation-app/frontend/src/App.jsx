import { useState, useEffect, useCallback, useRef } from 'react'
import './App.css'

const API = '/api'
const DEBOUNCE_MS = 350

function App() {
  const [sourceLanguages, setSourceLanguages] = useState({})
  const [targetLanguages, setTargetLanguages] = useState({})
  const [speechLanguages, setSpeechLanguages] = useState({})
  const [voices, setVoices] = useState([])
  const [voiceId, setVoiceId] = useState('')
  const [text, setText] = useState('')
  const [sourceLang, setSourceLang] = useState('en')
  const [targetLang, setTargetLang] = useState('es')
  const [translation, setTranslation] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [history, setHistory] = useState([])
  const [copiedToast, setCopiedToast] = useState(false)
  const [playingLang, setPlayingLang] = useState(null)
  const [loadingTts, setLoadingTts] = useState(null)
  const [recording, setRecording] = useState(false)
  const [loadingStt, setLoadingStt] = useState(false)
  const [mediaRecorder, setMediaRecorder] = useState(null)
  const currentAudioRef = useRef(null)
  const speakRef = useRef(null)

  const canSpeakInput = speechLanguages[sourceLang]

  useEffect(() => {
    fetch(`${API}/languages`)
      .then((r) => r.json())
      .then((d) => {
        setSourceLanguages(d.source_languages || d.languages || {})
        setTargetLanguages(d.target_languages || d.languages || {})
        setSpeechLanguages(d.speech_languages || {})
      })
      .catch(() => {
        setSourceLanguages({})
        setTargetLanguages({})
      })
  }, [])

  useEffect(() => {
    fetch(`${API}/voices?language=${targetLang}`)
      .then((r) => r.json())
      .then((d) => {
        const v = d.voices || []
        setVoices(v)
        setVoiceId((prev) => {
          const valid = v.some((x) => x.voiceId === prev)
          return v.length ? (valid ? prev : v[0].voiceId) : ''
        })
      })
      .catch(() => setVoices([]))
  }, [targetLang])

  useEffect(() => {
    if (Object.keys(targetLanguages).length && !targetLanguages[targetLang]) {
      setTargetLang(Object.keys(targetLanguages)[0])
    }
  }, [targetLanguages, targetLang])

  useEffect(() => {
    fetch(`${API}/history`)
      .then((r) => r.json())
      .then((d) => setHistory(d.history || []))
      .catch(() => setHistory([]))
  }, [translation])

  const speak = useCallback(async (textToSpeak, lang) => {
    if (!textToSpeak) return
    // Stop any currently playing audio to prevent overlapping
    if (currentAudioRef.current) {
      currentAudioRef.current.pause()
      currentAudioRef.current.src = ''
      currentAudioRef.current = null
      setPlayingLang(null)
    }
    setLoadingTts(lang)
    setError('')
    try {
      const res = await fetch(`${API}/tts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: textToSpeak, language: lang, voice_id: voiceId || undefined }),
      })
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}))
        const errMsg = typeof errData.detail === 'string' ? errData.detail : 'TTS failed.'
        throw new Error(errMsg)
      }
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const audio = new Audio(url)
      currentAudioRef.current = audio
      audio.onended = () => {
        currentAudioRef.current = null
        setPlayingLang(null)
        URL.revokeObjectURL(url)
      }
      audio.onerror = () => {
        currentAudioRef.current = null
        setError('Could not play audio')
        setLoadingTts(null)
      }
      setPlayingLang(lang)
      await audio.play()
    } catch (e) {
      currentAudioRef.current = null
      setError(e.message || 'TTS failed')
    } finally {
      setLoadingTts(null)
    }
  }, [voiceId])
  speakRef.current = speak

  const translate = useCallback(async () => {
    const toTranslate = text.trim()
    if (!toTranslate) return
    setLoading(true)
    setError('')
    setTranslation('')
    try {
      const res = await fetch(`${API}/translate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: toTranslate,
          source_lang: sourceLang,
          target_langs: [targetLang],
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        const msg = Array.isArray(data.detail) ? data.detail[0]?.msg : data.detail
        throw new Error(typeof msg === 'string' ? msg : 'Translation failed')
      }
      const translated = data.translations?.[targetLang] || ''
      setTranslation(translated)
      if (translated && speakRef.current) speakRef.current(translated, targetLang)
    } catch (e) {
      setError(e.message || 'Translation failed')
    } finally {
      setLoading(false)
    }
  }, [text, sourceLang, targetLang])

  useEffect(() => {
    if (!text.trim()) {
      setTranslation('')
      return
    }
    const id = setTimeout(() => translate(), DEBOUNCE_MS)
    return () => clearTimeout(id)
  }, [text, sourceLang, targetLang, translate])

  const downloadAudio = async () => {
    if (!translation) return
    try {
      const res = await fetch(`${API}/tts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: translation, language: targetLang, voice_id: voiceId || undefined }),
      })
      if (!res.ok) throw new Error('TTS failed')
      const blob = await res.blob()
      const a = document.createElement('a')
      a.href = URL.createObjectURL(blob)
      a.download = `langly-${targetLang}.wav`
      a.click()
      URL.revokeObjectURL(a.href)
    } catch (e) {
      setError(e.message)
    }
  }

  const startRecording = async () => {
    if (!canSpeakInput) return
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const recorder = new MediaRecorder(stream)
      const chunks = []

      recorder.ondataavailable = (e) => e.data.size && chunks.push(e.data)
      recorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop())
        const blob = new Blob(chunks, { type: 'audio/webm' })
        setLoadingStt(true)
        setError('')
        try {
          const formData = new FormData()
          formData.append('file', blob, 'audio.webm')
          const res = await fetch(`${API}/stt?language=${sourceLang}`, {
            method: 'POST',
            body: formData,
          })
          const data = await res.json().catch(() => ({}))
          if (!res.ok) throw new Error(data.detail || 'Speech recognition failed')
          const transcript = data.transcription || ''
          setText(transcript)
        } catch (e) {
          setError(e.message || 'Could not transcribe audio')
        } finally {
          setLoadingStt(false)
        }
      }

      recorder.start()
      setMediaRecorder(recorder)
      setRecording(true)
    } catch (e) {
      setError('Microphone access denied')
    }
  }

  const stopRecording = () => {
    if (mediaRecorder && recording) {
      mediaRecorder.stop()
      setRecording(false)
      setMediaRecorder(null)
    }
  }

  const copyText = (str) => {
    navigator.clipboard.writeText(str)
    setCopiedToast(true)
    setTimeout(() => setCopiedToast(false), 2000)
  }

  const loadHistoryItem = (item) => {
    setText(item.source_text)
    setSourceLang(item.source_lang)
    setTargetLang(item.target_lang)
    setTranslation(item.translated_text)
  }

  const sourceEntries = Object.entries(sourceLanguages)
  const targetEntries = Object.entries(targetLanguages).filter(
    ([code]) => code !== sourceLang
  )
  const targetOptions = targetEntries.length ? targetEntries : Object.entries(targetLanguages)

  return (
    <div className="app">
      <header className="header">
        <div className="header-main">
          <div>
            <h1>Langly</h1>
            <p>Translate text and hear it spoken</p>
          </div>
          {voices.length > 0 && (
            <div className="voice-select-wrap">
              <label htmlFor="voice-select">Voice</label>
              <select
                id="voice-select"
                className="voice-select"
                value={voiceId}
                onChange={(e) => setVoiceId(e.target.value)}
              >
                {voices.map((v) => (
                  <option key={v.voiceId} value={v.voiceId}>{v.displayName}</option>
                ))}
              </select>
            </div>
          )}
        </div>
      </header>

      <div className="main-grid">
        <div className="translate-section">
          <div className="lang-row">
            <div className="input-group">
              <label>From</label>
              <select
                className="lang-select"
                value={sourceLang}
                onChange={(e) => setSourceLang(e.target.value)}
              >
                {sourceEntries.map(([code, name]) => (
                  <option key={code} value={code}>{name}</option>
                ))}
              </select>
            </div>
            <div className="input-group">
              <label>To</label>
              <select
                className="lang-select"
                value={targetLang}
                onChange={(e) => setTargetLang(e.target.value)}
              >
                {targetOptions.map(([code, name]) => (
                  <option key={code} value={code}>{name}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="input-group">
            <label>Text</label>
            <div className="text-input-wrap">
              <textarea
                className="text-input"
                placeholder={`Type or paste text in ${sourceLanguages[sourceLang] || 'your language'}...`}
                value={text}
                onChange={(e) => setText(e.target.value)}
              />
              {canSpeakInput && (
                <button
                  type="button"
                  className={`mic-btn ${recording ? 'recording' : ''} ${loadingStt ? 'loading' : ''}`}
                  onClick={recording ? stopRecording : startRecording}
                  disabled={loadingStt}
                  title={recording ? 'Stop recording' : 'Speak input'}
                >
                  {loadingStt ? (
                    <span className="mic-btn-spinner" />
                  ) : recording ? (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="6" width="12" height="12" rx="2"/></svg>
                  ) : (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm5.91-3c-.49 0-.9.36-.98.85C16.52 14.2 14.47 16 12 16s-4.52-1.8-4.93-4.15c-.08-.49-.49-.85-.98-.85-.61 0-1.09.54-1 1.14.49 3 2.89 5.35 5.91 5.78V20c0 .55.45 1 1 1s1-.45 1-1v-2.08c3.02-.43 5.42-2.78 5.91-5.78.1-.6-.39-1.14-1-1.14z"/></svg>
                  )}
                </button>
              )}
            </div>
            {canSpeakInput && (
              <span className="input-hint">Or click the mic to speak in {sourceLanguages[sourceLang]}</span>
            )}
          </div>

          {error && <div className="error">{error}</div>}

          {loading && !translation && text.trim() && (
            <div className="translating-hint">Translating...</div>
          )}

          {translation && (
            <div className="results">
              <div className={`result-card ${loading ? 'updating' : ''}`}>
                <div className="result-lang">
                  {targetLanguages[targetLang] || targetLang}
                  {loading && <span className="updating-badge">Updating...</span>}
                </div>
                <div className="result-text">{translation}</div>
                <div className="result-actions">
                  <button
                    className="play-btn"
                    onClick={() => speak(translation, targetLang)}
                    disabled={loadingTts === targetLang}
                    title="Listen"
                  >
                    {loadingTts === targetLang ? (
                      <span className="play-btn-spinner" />
                    ) : playingLang === targetLang ? (
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16" rx="1"/><rect x="14" y="4" width="4" height="16" rx="1"/></svg>
                    ) : (
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
                    )}
                  </button>
                  <button onClick={() => copyText(translation)}>Copy</button>
                  <button onClick={downloadAudio}>Download</button>
                </div>
              </div>
            </div>
          )}
        </div>

        <aside className="history-section">
          <div className="section-title">History</div>
          <div className="history-list">
            {history.length === 0 ? (
              <div className="history-empty">No translations yet</div>
            ) : (
              history.map((item) => (
                <div
                  key={item.id}
                  className="history-item"
                  onClick={() => loadHistoryItem(item)}
                >
                  <div className="history-source">
                    {item.source_text.slice(0, 50)}
                    {item.source_text.length > 50 ? '...' : ''}
                  </div>
                  <div className="history-target">
                    {targetLanguages[item.target_lang] || item.target_lang}:{' '}
                    {item.translated_text.slice(0, 35)}
                    {item.translated_text.length > 35 ? '...' : ''}
                  </div>
                </div>
              ))
            )}
          </div>
        </aside>
      </div>

      {copiedToast && <div className="copied-toast">Copied!</div>}
    </div>
  )
}

export default App
