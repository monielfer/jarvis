import React, { useState, useCallback, useEffect, useRef } from 'react';
import JarvisSphere from './components/JarvisSphere.jsx';
import AgentHUD from './components/AgentHUD.jsx';
import VoiceMic from './components/VoiceMic.jsx';
import { useJarvisSocket } from './hooks/useJarvisSocket.js';
import { useVoice } from './hooks/useVoice.js';
import './styles/global.css';

export default function App() {
  const { sphereState, agentStates, lastReply, lastError, streamingReply, sendMessage, connected } =
    useJarvisSocket();

  const [input, setInput]         = useState('');
  const [transcript, setTranscript] = useState('');
  const [voiceReply, setVoiceReply] = useState('');

  // When voice produces a reply, also show text
  const handleVoiceReply = useCallback((text) => {
    setVoiceReply(text);
  }, []);

  const handleTranscript = useCallback((text) => {
    setTranscript(text);
  }, []);

  const {
    voiceState,
    supported: voiceSupported,
    wakeSupported,
    wakeWordActive,
    toggleMic,
    stopSpeaking,
    enableWakeWord,
    disableWakeWord,
  } = useVoice({
    onTranscript: handleTranscript,
    onReply: handleVoiceReply,
  });

  // Merge sphere state: voice activity overrides socket state
  const rawSphereState =
    voiceState === 'listening'  ? 'thinking'  :
    voiceState === 'processing' ? 'thinking'  :
    voiceState === 'speaking'   ? 'speaking'  :
    voiceState === 'error'      ? 'error'     :
    sphereState;

  // Throttle 100ms: evita que mudanças rápidas de estado estroboscopiem a esfera
  const [effectiveSphereState, setEffectiveSphereState] = useState(rawSphereState);
  const throttleRef = useRef(null);
  useEffect(() => {
    if (throttleRef.current) return;
    throttleRef.current = setTimeout(() => {
      setEffectiveSphereState(rawSphereState);
      throttleRef.current = null;
    }, 100);
  }, [rawSphereState]);

  function handleSubmit(e) {
    e.preventDefault();
    if (!input.trim()) return;
    sendMessage(input.trim());
    setTranscript('');
    setVoiceReply('');
    setInput('');
  }

  // streamingReply: texto chegando token a token
  // voiceReply: resposta completa via voz
  // lastReply: resposta completa via texto
  const displayReply = streamingReply || voiceReply || lastReply?.reply || null;
  const displayTranscript = transcript || null;

  return (
    <div className="jarvis-root">
      {/* ── Header ─────────────────────────────────────────── */}
      <header className="jarvis-header">
        <div className="jarvis-header-left">
          <span className="jarvis-title">J.A.R.V.I.S</span>
          <span className="jarvis-subtitle">Just A Rather Very Intelligent System</span>
        </div>
        <div className="jarvis-header-right">
          {wakeSupported && (
            <button
              className={`jarvis-wake-toggle ${wakeWordActive ? 'jarvis-wake-toggle--on' : ''}`}
              onClick={wakeWordActive ? disableWakeWord : enableWakeWord}
              title={wakeWordActive ? 'Desativar wake word' : 'Ativar "Ei JARVIS"'}
            >
              {wakeWordActive ? '◉ WAKE WORD ON' : '◎ WAKE WORD OFF'}
            </button>
          )}
          <span className={`jarvis-conn-badge ${connected ? 'jarvis-conn-badge--on' : ''}`}>
            {connected ? '● ONLINE' : '○ OFFLINE'}
          </span>
        </div>
      </header>

      {/* ── Body ───────────────────────────────────────────── */}
      <div className="jarvis-body">
        {/* Left HUD — agents */}
        <AgentHUD agentStates={agentStates} connected={connected} />

        {/* Centre — Sphere + controls */}
        <main className="jarvis-centre">
          {/* Sphere with mic button overlay */}
          <div className="sphere-voice-wrapper">
            <JarvisSphere sphereState={effectiveSphereState} />
            {voiceSupported && (
              <VoiceMic
                voiceState={voiceState}
                wakeWordActive={wakeWordActive}
                onToggle={toggleMic}
                onStopSpeaking={stopSpeaking}
              />
            )}
            {!voiceSupported && (
              <p className="voice-not-supported">
                Microfone indisponível — use Chrome ou Edge, e abra via <strong>localhost</strong>
              </p>
            )}
            <div className={`sphere-state-label sphere-state-label--${effectiveSphereState}`}>
              {effectiveSphereState === 'idle'     && 'STANDBY'}
              {effectiveSphereState === 'thinking' && 'PROCESSING'}
              {effectiveSphereState === 'speaking' && 'RESPONDING'}
              {effectiveSphereState === 'error'    && 'ERROR'}
            </div>
          </div>

          {/* User transcript (what Whisper heard) */}
          {displayTranscript && (
            <div className="jarvis-transcript">
              <span className="jarvis-reply-label">VOCÊ</span>
              <p className="jarvis-reply-text">{displayTranscript}</p>
            </div>
          )}

          {/* JARVIS reply — streaming (cursor piscando) ou completo */}
          {displayReply && (
            <div className="jarvis-reply">
              <span className="jarvis-reply-label">JARVIS</span>
              <p className="jarvis-reply-text">
                {displayReply}
                {streamingReply && <span className="jarvis-stream-cursor" />}
              </p>
            </div>
          )}

          {lastError && (
            <div className="jarvis-reply jarvis-reply--error">
              <span className="jarvis-reply-label">ERRO</span>
              <p className="jarvis-reply-text">{lastError}</p>
            </div>
          )}

          {/* Text input row */}
          <form className="jarvis-input-form" onSubmit={handleSubmit}>
            <input
              className="jarvis-input"
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ou digite aqui..."
              disabled={!connected || sphereState === 'thinking'}
              autoComplete="off"
              spellCheck={false}
            />
            <button
              className="jarvis-send-btn"
              type="submit"
              disabled={!connected || !input.trim() || sphereState === 'thinking'}
            >
              {sphereState === 'thinking' ? '...' : '▶'}
            </button>
          </form>
        </main>

        {/* Right — context panel */}
        <aside className="jarvis-right-panel">
          <div className="hud-panel">
            <div className="hud-header">
              <span className="hud-title">CONTEXT</span>
            </div>
            <div className="hud-divider" />
            <div className="hud-context-items">
              <div className="hud-context-item">
                <span className="hud-context-label">ENTITY</span>
                <span className="hud-context-value">Zaltryon</span>
              </div>
              <div className="hud-context-item">
                <span className="hud-context-label">TYPE</span>
                <span className="hud-context-value">SaaS</span>
              </div>
              <div className="hud-divider" style={{ margin: '0.75rem 0' }} />
              <div className="hud-context-item">
                <span className="hud-context-label">ENTITY</span>
                <span className="hud-context-value">MonieTech</span>
              </div>
              <div className="hud-context-item">
                <span className="hud-context-label">TYPE</span>
                <span className="hud-context-value">Store + Tech Support</span>
              </div>
              <div className="hud-divider" style={{ margin: '0.75rem 0' }} />
              <div className="hud-context-item">
                <span className="hud-context-label">VOICE</span>
                <span className="hud-context-value" style={{ color: voiceSupported ? 'var(--color-primary)' : 'var(--color-muted)' }}>
                  {voiceSupported ? 'ENABLED' : 'N/A (HTTP)'}
                </span>
              </div>
              <div className="hud-context-item">
                <span className="hud-context-label">MODEL STT</span>
                <span className="hud-context-value">Whisper-1</span>
              </div>
              <div className="hud-context-item">
                <span className="hud-context-label">MODEL TTS</span>
                <span className="hud-context-value">TTS-1 · Onyx</span>
              </div>
            </div>
          </div>
        </aside>
      </div>

      {/* ── Footer ─────────────────────────────────────────── */}
      <footer className="jarvis-footer">
        <span className="jarvis-footer-state">
          {voiceState === 'listening'  && 'GRAVANDO — FALE AGORA'}
          {voiceState === 'processing' && 'PROCESSANDO VOZ...'}
          {voiceState === 'speaking'   && 'JARVIS FALANDO'}
          {voiceState === 'idle' && sphereState === 'idle'     && 'SYSTEM STANDBY'}
          {voiceState === 'idle' && sphereState === 'thinking' && 'PROCESSANDO...'}
          {voiceState === 'idle' && sphereState === 'speaking' && 'RESPOSTA PRONTA'}
          {voiceState === 'idle' && sphereState === 'error'    && 'ERRO — TENTE NOVAMENTE'}
        </span>
      </footer>
    </div>
  );
}
