import React from 'react';

/**
 * VoiceMic — Microphone button overlay for the JARVIS sphere.
 *
 * States map to visual feedback:
 *  idle       → pulsing cyan ring, mic icon
 *  listening  → red recording indicator + stop icon
 *  processing → spinning ring, hourglass
 *  speaking   → animated bars, stop icon
 *  error      → red flash
 */
export default function VoiceMic({
  voiceState = 'idle',
  wakeWordActive = false,
  supported = false,
  onToggle,
  onStopSpeaking,
}) {
  // Parent (App.jsx) only renders this component when voiceSupported is true

  function handleClick() {
    if (voiceState === 'speaking') {
      onStopSpeaking?.();
    } else {
      onToggle?.();
    }
  }

  const isActive    = voiceState === 'listening';
  const isProcessing = voiceState === 'processing';
  const isSpeaking  = voiceState === 'speaking';
  const isError     = voiceState === 'error';

  return (
    <div className="voice-mic-wrapper">
      {/* Wake word indicator */}
      {wakeWordActive && voiceState === 'idle' && (
        <div className="voice-wake-badge">
          <span className="voice-wake-dot" />
          <span>Diga "Ei JARVIS"</span>
        </div>
      )}

      {/* Main mic button */}
      <button
        className={[
          'voice-mic-btn',
          isActive     && 'voice-mic-btn--listening',
          isProcessing && 'voice-mic-btn--processing',
          isSpeaking   && 'voice-mic-btn--speaking',
          isError      && 'voice-mic-btn--error',
        ].filter(Boolean).join(' ')}
        onClick={handleClick}
        disabled={isProcessing}
        title={
          isActive     ? 'Parar gravação' :
          isSpeaking   ? 'Parar reprodução' :
          isProcessing ? 'Processando...' :
                         'Falar com JARVIS'
        }
      >
        {isActive     && <RecordingIcon />}
        {isProcessing && <ProcessingIcon />}
        {isSpeaking   && <SpeakingIcon />}
        {!isActive && !isProcessing && !isSpeaking && <MicIcon />}
      </button>

      {/* State label */}
      <span className={`voice-state-tag voice-state-tag--${voiceState}`}>
        {isActive     && 'GRAVANDO'}
        {isProcessing && 'PROCESSANDO'}
        {isSpeaking   && 'REPRODUZINDO'}
        {isError      && 'ERRO — TENTE NOVAMENTE'}
      </span>
    </div>
  );
}

// ── Icons ──────────────────────────────────────────────────────────────────
function MicIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" width="22" height="22">
      <path d="M12 1a4 4 0 0 1 4 4v6a4 4 0 0 1-8 0V5a4 4 0 0 1 4-4zm0 2a2 2 0 0 0-2 2v6a2 2 0 0 0 4 0V5a2 2 0 0 0-2-2z"/>
      <path d="M19 10a1 1 0 0 1 2 0 9 9 0 0 1-8 8.94V21h2a1 1 0 0 1 0 2H9a1 1 0 0 1 0-2h2v-2.06A9 9 0 0 1 3 10a1 1 0 0 1 2 0 7 7 0 0 0 14 0z"/>
    </svg>
  );
}

function RecordingIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20">
      <rect x="6" y="6" width="12" height="12" rx="2" />
    </svg>
  );
}

function ProcessingIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="32" height="32"
      style={{ animation: 'spin 1s linear infinite' }}>
      <circle cx="12" cy="12" r="10" strokeOpacity="0.25"/>
      <path d="M12 2a10 10 0 0 1 10 10" strokeLinecap="round"/>
    </svg>
  );
}

function SpeakingIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" width="32" height="32">
      <rect x="3"  y="8" width="3" height="8" rx="1.5" style={{ animation: 'bar1 0.8s ease-in-out infinite' }}/>
      <rect x="7.5" y="5" width="3" height="14" rx="1.5" style={{ animation: 'bar2 0.8s ease-in-out infinite 0.15s' }}/>
      <rect x="12" y="8" width="3" height="8" rx="1.5" style={{ animation: 'bar1 0.8s ease-in-out infinite 0.3s' }}/>
      <rect x="16.5" y="5" width="3" height="14" rx="1.5" style={{ animation: 'bar2 0.8s ease-in-out infinite 0.45s' }}/>
    </svg>
  );
}
