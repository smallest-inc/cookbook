import React, { useState, useEffect, useCallback } from 'react'
import { useAtomsCall } from 'atoms-widget-core'

const assistantId = import.meta.env.VITE_SMALLEST_ASSISTANT_ID as string | undefined

// Smallest.ai logo (from brand asset)
const smallestLogoUrl = '/smallest-logo.png'

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

const styles = `
  * { margin: 0; padding: 0; box-sizing: border-box; }
  .phone-frame {
    min-height: 100vh; min-height: 100dvh;
    background: #1a1a1a;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 1rem;
  }
  .phone-device {
    width: 100%;
    max-width: 390px;
    min-height: 700px;
    max-height: 90vh;
    background: #33363B;
    border-radius: 44px;
    overflow: hidden;
    position: relative;
    box-shadow: 0 0 0 3px #2a2a2e, 0 25px 50px rgba(0,0,0,0.5);
  }
  .phone-notch {
    position: absolute;
    top: 0;
    left: 50%;
    transform: translateX(-50%);
    width: 120px;
    height: 28px;
    background: #33363B;
    border-radius: 0 0 20px 20px;
    z-index: 10;
  }
  .caller-viewport {
    min-height: 100vh; min-height: 100dvh;
    background: #33363B;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 2rem 1.5rem 6rem;
    position: relative;
  }
  .caller-close {
    position: absolute;
    top: 1.25rem;
    right: 1.25rem;
    width: 36px;
    height: 36px;
    border-radius: 50%;
    background: rgba(255,255,255,0.08);
    border: none;
    color: #fff;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 1.125rem;
    transition: background 0.2s;
  }
  .caller-close:hover {
    background: rgba(255,255,255,0.14);
  }
  .caller-logo-above {
    display: flex;
    align-items: center;
    justify-content: center;
    margin-bottom: 5rem;
    padding: 1rem;
    border: 2px solid rgba(255,255,255,0.6);
    border-radius: 12px;
  }
  .caller-logo-above img {
    height: 300px;
    width: auto;
    object-fit: contain;
  }
  .caller-timer {
    font-size: 1.5rem;
    font-weight: 500;
    color: #fff;
    letter-spacing: 0.05em;
    margin-bottom: 3rem;
  }
  .caller-controls {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 2rem;
    width: 100%;
    max-width: 320px;
  }
  .caller-mic {
    width: 56px;
    height: 56px;
    border-radius: 50%;
    background: #2E7D7C;
    border: none;
    color: #fff;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: transform 0.15s, box-shadow 0.15s;
    box-shadow: 0 4px 16px rgba(46,125,124,0.4);
  }
  .caller-mic:hover {
    transform: scale(1.05);
    box-shadow: 0 6px 24px rgba(46,125,124,0.5);
  }
  .caller-mic:active {
    transform: scale(0.98);
  }
  .caller-mic.muted {
    background: #4a5568;
    box-shadow: 0 4px 16px rgba(0,0,0,0.2);
  }
  .caller-mic svg {
    width: 24px;
    height: 24px;
  }
  .caller-end {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    padding: 0.875rem 1.75rem;
    border-radius: 12px;
    background: #E04B45;
    border: none;
    color: #fff;
    font-size: 1rem;
    font-weight: 600;
    cursor: pointer;
    transition: transform 0.15s, box-shadow 0.15s;
    box-shadow: 0 4px 16px rgba(224,75,69,0.4);
  }
  .caller-end:hover {
    transform: scale(1.02);
    box-shadow: 0 6px 24px rgba(224,75,69,0.5);
  }
  .caller-end:active {
    transform: scale(0.98);
  }
  .caller-end svg {
    width: 16px;
    height: 16px;
  }
  .caller-start-wrap {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 1rem;
  }
  .caller-start-label {
    color: #fff;
    font-size: 1rem;
    font-weight: 600;
  }
  .caller-start-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 1rem 2rem;
    border-radius: 14px;
    background: #2E7D7C;
    border: none;
    cursor: pointer;
    transition: transform 0.15s, box-shadow 0.15s;
    box-shadow: 0 4px 16px rgba(46,125,124,0.4);
  }
  .caller-start-btn:hover {
    transform: scale(1.02);
    box-shadow: 0 6px 24px rgba(46,125,124,0.5);
  }
  .caller-start-btn:disabled {
    opacity: 0.6;
    cursor: not-allowed;
    transform: none;
  }
  .caller-start-btn svg {
    width: 32px;
    height: 32px;
    color: #fff;
  }
  .caller-error {
    color: #e2e8f0;
    text-align: center;
    font-size: 0.9375rem;
    margin-top: 1rem;
  }
  .caller-status {
    color: rgba(255,255,255,0.6);
    font-size: 0.875rem;
    margin-top: 0.5rem;
  }
`

function MicIcon({ muted }: { muted?: boolean }) {
  if (muted) {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <line x1="1" y1="1" x2="23" y2="23" />
        <path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V5a3 3 0 0 0-5.94-.6" />
        <path d="M17 16.95A7 7 0 0 1 5 12v-2m14 0v2a7 7 0 0 1-.11 1.23" />
      </svg>
    )
  }
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
      <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
      <line x1="12" y1="19" x2="12" y2="23" />
      <line x1="8" y1="23" x2="16" y2="23" />
    </svg>
  )
}

function EndIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor">
      <rect x="6" y="6" width="12" height="12" rx="2" />
    </svg>
  )
}

function CallerUI() {
  const [callSeconds, setCallSeconds] = useState(0)
  const [closed, setClosed] = useState(false)

  const {
    isCallActive,
    connectionStatus,
    isMuted,
    error,
    toggleCall,
    toggleMute,
    endCall,
  } = useAtomsCall({
    enabled: Boolean(assistantId),
    assistantId: assistantId || '',
    onError: (err) => console.error('Atoms call error:', err),
  })

  useEffect(() => {
    if (!isCallActive) {
      setCallSeconds(0)
      return
    }
    const t = setInterval(() => setCallSeconds((s) => s + 1), 1000)
    return () => clearInterval(t)
  }, [isCallActive])

  const handleEndCall = useCallback(async () => {
    await endCall()
  }, [endCall])

  const handleClose = useCallback(() => {
    if (isCallActive) {
      endCall()
    }
    setClosed(true)
  }, [isCallActive, endCall])

  if (closed) {
    return (
      <div className="phone-frame">
        <div className="phone-device">
          <div className="phone-notch" />
          <div className="caller-viewport">
        <p className="caller-status">Call ended</p>
        <button className="caller-start-btn" onClick={() => setClosed(false)} title="Start new call">
          <MicIcon />
        </button>
        <span className="caller-start-label">Start new call</span>
        <style>{styles}</style>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="phone-frame">
      <div className="phone-device">
        <div className="phone-notch" />
        <div className="caller-viewport">
      <button className="caller-close" onClick={handleClose} aria-label="Close">
        ×
      </button>

      <div className="caller-logo-above">
        <img src={smallestLogoUrl} alt="Smallest.ai" />
      </div>

      {isCallActive ? (
        <>
          <div className="caller-timer">{formatDuration(callSeconds)}</div>
          <div className="caller-controls">
            <button
              className={`caller-mic ${isMuted ? 'muted' : ''}`}
              onClick={toggleMute}
              aria-label={isMuted ? 'Unmute' : 'Mute'}
            >
              <MicIcon muted={isMuted} />
            </button>
            <button className="caller-end" onClick={handleEndCall}>
              <EndIcon />
              End
            </button>
          </div>
        </>
      ) : (
        <div className="caller-start-wrap">
          <button
            className="caller-start-btn"
            onClick={() => toggleCall()}
            disabled={connectionStatus === 'connecting'}
            title={connectionStatus === 'connecting' ? 'Connecting…' : 'Start call'}
          >
            <MicIcon />
          </button>
          <span className="caller-start-label">
            {connectionStatus === 'connecting' ? 'Connecting…' : 'Start call'}
          </span>
          {error && <p className="caller-error">{error}</p>}
          {connectionStatus === 'connecting' && (
            <p className="caller-status">Connecting to Calendar Receptionist…</p>
          )}
        </div>
      )}

      <style>{styles}</style>
        </div>
      </div>
    </div>
  )
}

export default function App() {
  if (!assistantId) {
    return (
      <div className="phone-frame">
        <div className="phone-device">
          <div className="phone-notch" />
          <div className="caller-viewport" style={{ flexDirection: 'column', gap: '1rem' }}>
            <span style={{ fontSize: '2rem', color: '#E04B45' }}>⚠</span>
            <p style={{ color: '#e2e8f0', textAlign: 'center' }}>
              Add VITE_SMALLEST_ASSISTANT_ID to client/.env
            </p>
            <style>{styles}</style>
          </div>
        </div>
      </div>
    )
  }

  return <CallerUI />
}
