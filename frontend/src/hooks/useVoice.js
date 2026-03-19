import { useRef, useState, useEffect, useCallback } from 'react';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001';
const WAKE_WORDS = ['ei jarvis', 'hey jarvis', 'oi jarvis', 'jarvis'];

export function useVoice({ onTranscript, onReply, onStateChange } = {}) {
  const [voiceState, setVoiceState]         = useState('idle');
  const [supported, setSupported]           = useState(false);
  const [wakeSupported, setWakeSupported]   = useState(false);
  const [wakeWordActive, setWakeWordActive] = useState(false);

  // Refs — always up-to-date inside async callbacks
  const voiceStateRef      = useRef('idle');
  const mediaRecorderRef   = useRef(null);
  const audioChunksRef     = useRef([]);
  const audioRef           = useRef(null);
  const audioCtxRef        = useRef(null);    // shared AudioContext (unlocked by user gesture)
  const sessionId          = useRef(crypto.randomUUID());
  const wakeActiveRef      = useRef(false);
  const wakeRecRef         = useRef(null);

  function setState(s) {
    voiceStateRef.current = s;
    setVoiceState(s);
    onStateChange?.(s);
  }

  // ── Browser support check ──────────────────────────────────────────────────
  useEffect(() => {
    const micOk = 'mediaDevices' in navigator && 'MediaRecorder' in window;
    setSupported(micOk);
    const wakeOk = micOk && !!(window.SpeechRecognition || window.webkitSpeechRecognition);
    setWakeSupported(wakeOk);
  }, []);

  // ── Unlock AudioContext on first user interaction ──────────────────────────
  // Browsers block autoplay until the user clicks something.
  // We create and resume the AudioContext on the first click so subsequent
  // audio (from wake word trigger) plays without being blocked.
  useEffect(() => {
    function unlock() {
      if (!audioCtxRef.current) {
        audioCtxRef.current = new AudioContext();
      }
      if (audioCtxRef.current.state === 'suspended') {
        audioCtxRef.current.resume();
      }
      window.removeEventListener('click', unlock);
      window.removeEventListener('keydown', unlock);
    }
    window.addEventListener('click', unlock);
    window.addEventListener('keydown', unlock);
    return () => {
      window.removeEventListener('click', unlock);
      window.removeEventListener('keydown', unlock);
    };
  }, []);

  // ── Send audio → Whisper → Claude → TTS ───────────────────────────────────
  const sendAudio = useCallback(async (blob) => {
    setState('processing');
    try {
      const form = new FormData();
      form.append('audio', blob, 'recording.webm');
      form.append('sessionId', sessionId.current);
      form.append('language', 'pt');

      const res = await fetch(`${API_BASE}/api/voice/chat`, { method: 'POST', body: form });
      if (!res.ok) throw new Error((await res.json()).error || 'Voice chat failed');

      const transcript = decodeURIComponent(res.headers.get('X-User-Transcript') || '');
      const reply      = decodeURIComponent(res.headers.get('X-Jarvis-Reply')    || '');
      onTranscript?.(transcript);
      onReply?.(reply);

      const arrayBuffer = await res.arrayBuffer();
      setState('speaking');

      // Use shared AudioContext (already unlocked by user click) to bypass autoplay block
      if (!audioCtxRef.current) audioCtxRef.current = new AudioContext();
      const ctx = audioCtxRef.current;
      if (ctx.state === 'suspended') await ctx.resume();

      const decoded = await ctx.decodeAudioData(arrayBuffer);
      const source  = ctx.createBufferSource();
      source.buffer = decoded;
      source.connect(ctx.destination);
      source.onended = () => {
        setState('idle');
        if (wakeActiveRef.current) _startLoop();
      };
      source.start(0);
      audioRef.current = source;
    } catch (err) {
      console.error('[Voice]', err.message);
      setState('error');
      setTimeout(() => {
        setState('idle');
        if (wakeActiveRef.current) _startLoop();
      }, 3000);
    }
  }, [onTranscript, onReply]);

  // ── Record mic with auto-stop on silence ───────────────────────────────────
  const startRecording = useCallback(async () => {
    if (voiceStateRef.current !== 'idle') return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioChunksRef.current = [];

      const recorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
      mediaRecorderRef.current = recorder;
      recorder.ondataavailable = (e) => { if (e.data.size > 0) audioChunksRef.current.push(e.data); };
      recorder.onstop = () => {
        stream.getTracks().forEach(t => t.stop());
        audioCtx.close();
        sendAudio(new Blob(audioChunksRef.current, { type: 'audio/webm' }));
      };
      recorder.start();
      setState('listening');

      // ── Silence detection via AudioContext ──────────────────────────────
      const audioCtx  = new AudioContext();
      const analyser  = audioCtx.createAnalyser();
      const source    = audioCtx.createMediaStreamSource(stream);
      source.connect(analyser);
      analyser.fftSize = 512;
      const data = new Uint8Array(analyser.frequencyBinCount);

      const SILENCE_THRESHOLD = 8;   // volume level below this = silence
      const SILENCE_DURATION  = 1800; // ms of silence before auto-stop
      const MAX_DURATION      = 15000; // hard cap at 15s

      let silenceStart = null;
      let rafId;

      const check = () => {
        if (voiceStateRef.current !== 'listening') return;
        analyser.getByteFrequencyData(data);
        const vol = data.reduce((a, b) => a + b, 0) / data.length;

        if (vol < SILENCE_THRESHOLD) {
          if (!silenceStart) silenceStart = Date.now();
          else if (Date.now() - silenceStart > SILENCE_DURATION) {
            if (recorder.state === 'recording') recorder.stop();
            return;
          }
        } else {
          silenceStart = null;
        }
        rafId = requestAnimationFrame(check);
      };
      rafId = requestAnimationFrame(check);

      // Hard cap
      setTimeout(() => {
        cancelAnimationFrame(rafId);
        if (recorder.state === 'recording') recorder.stop();
      }, MAX_DURATION);

    } catch (err) {
      console.error('[Voice] Mic denied:', err.message);
      setState('error');
      setTimeout(() => setState('idle'), 3000);
    }
  }, [sendAudio]);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current?.state === 'recording') mediaRecorderRef.current.stop();
  }, []);

  const toggleMic = useCallback(() => {
    if (voiceStateRef.current === 'listening') {
      stopRecording();
    } else if (voiceStateRef.current === 'idle') {
      _stopLoop();          // pause wake word while manually recording
      startRecording();
    }
  }, [startRecording, stopRecording]);

  const stopSpeaking = useCallback(() => {
    try { audioRef.current?.stop(); } catch (_) {}
    setState('idle');
  }, []);

  // ── Wake Word — creates a FRESH instance on every (re)start ───────────────
  function _startLoop() {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR || !wakeActiveRef.current) return;

    // Stop any existing instance first
    try { wakeRecRef.current?.stop(); } catch (_) {}
    wakeRecRef.current = null;

    const rec = new SR();
    rec.continuous      = false;   // single utterance — more reliable
    rec.interimResults  = false;
    rec.lang            = 'pt-BR';
    rec.maxAlternatives = 3;
    wakeRecRef.current  = rec;

    rec.onresult = (event) => {
      // Check all alternatives for wake word
      for (let i = 0; i < event.results.length; i++) {
        for (let j = 0; j < event.results[i].length; j++) {
          const heard = event.results[i][j].transcript.toLowerCase().trim();
          console.log('[WakeWord] Heard:', heard);
          if (WAKE_WORDS.some(w => heard.includes(w))) {
            console.log('[WakeWord] TRIGGERED');
            wakeRecRef.current = null;
            startRecording();
            return;
          }
        }
      }
    };

    rec.onerror = (e) => {
      // 'no-speech' is normal — just restart
      if (e.error !== 'no-speech') console.warn('[WakeWord] Error:', e.error);
    };

    rec.onend = () => {
      // Always restart if wake word should still be active and not recording
      if (wakeActiveRef.current && voiceStateRef.current === 'idle') {
        setTimeout(_startLoop, 300);  // small delay avoids race condition
      }
    };

    try {
      rec.start();
      setWakeWordActive(true);
    } catch (err) {
      console.warn('[WakeWord] Start failed:', err.message);
      if (wakeActiveRef.current) setTimeout(_startLoop, 1000);
    }
  }

  function _stopLoop() {
    wakeActiveRef.current = false;
    try { wakeRecRef.current?.stop(); } catch (_) {}
    wakeRecRef.current = null;
    setWakeWordActive(false);
  }

  const enableWakeWord = useCallback(() => {
    wakeActiveRef.current = true;
    _startLoop();
  }, []);

  const disableWakeWord = useCallback(() => {
    _stopLoop();
  }, []);

  // Auto-start wake word on mount when supported
  useEffect(() => {
    if (!wakeSupported) return;
    wakeActiveRef.current = true;
    _startLoop();
    return () => {
      _stopLoop();
      audioRef.current?.pause();
    };
  }, [wakeSupported]);

  return {
    voiceState,
    supported,
    wakeSupported,
    wakeWordActive,
    toggleMic,
    stopSpeaking,
    enableWakeWord,
    disableWakeWord,
  };
}
