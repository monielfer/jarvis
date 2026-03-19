import { useEffect, useRef, useState, useCallback } from 'react';
import { io } from 'socket.io-client';

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:3001';

export function useJarvisSocket() {
  const socketRef     = useRef(null);
  const streamBufRef  = useRef('');          // acumula deltas sem stale closure

  const [connected,      setConnected]      = useState(false);
  const [sphereState,    setSphereState]    = useState('idle');
  const [agentStates,    setAgentStates]    = useState({});
  const [lastReply,      setLastReply]      = useState(null);
  const [lastError,      setLastError]      = useState(null);
  const [streamingReply, setStreamingReply] = useState('');  // texto sendo digitado

  useEffect(() => {
    const socket = io(SOCKET_URL, {
      transports: ['websocket'],
      reconnectionDelay: 1000,
      reconnectionAttempts: 10,
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      setConnected(true);
      socket.emit('jarvis:get-agent-states');
    });

    socket.on('disconnect', () => setConnected(false));

    socket.on('jarvis:sphere-state', ({ state }) => setSphereState(state));

    socket.on('jarvis:agent-states', (states) => setAgentStates(states));

    socket.on('jarvis:agent-update', ({ agent, status }) => {
      setAgentStates((prev) => ({ ...prev, [agent]: status }));
    });

    // ── Streaming: cada delta de texto ───────────────────────────────────────
    socket.on('jarvis:stream-chunk', ({ chunk }) => {
      streamBufRef.current += chunk;
      setStreamingReply(streamBufRef.current);
    });

    // ── Resposta completa: limpa o stream buffer e grava lastReply ───────────
    socket.on('jarvis:reply', (data) => {
      setLastReply(data);
      setLastError(null);
      streamBufRef.current = '';
      setStreamingReply('');
    });

    socket.on('jarvis:error', ({ error }) => {
      setLastError(error);
      streamBufRef.current = '';
      setStreamingReply('');
    });

    return () => socket.disconnect();
  }, []);

  const sendMessage = useCallback((message, sessionId = crypto.randomUUID()) => {
    if (!socketRef.current?.connected) return;
    setLastError(null);
    setLastReply(null);
    streamBufRef.current = '';
    setStreamingReply('');
    socketRef.current.emit('jarvis:message', { message, sessionId });
  }, []);

  return {
    sphereState,
    agentStates,
    lastReply,
    lastError,
    streamingReply,   // ← novo: texto chegando em tempo real
    sendMessage,
    connected,
  };
}
