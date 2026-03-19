import { streamMessage } from './aiService.js';

/**
 * Sphere visual states — synced to frontend via socket.
 * idle     → Cyan   (#00e5ff)  — standby, listening
 * thinking → Blue   (#2979ff)  — processing, calling Claude
 * speaking → White  (#ffffff)  — delivering response
 * error    → Red    (#ff1744)  — something went wrong
 */
export const SPHERE_STATES = {
  IDLE: 'idle',
  THINKING: 'thinking',
  SPEAKING: 'speaking',
  ERROR: 'error',
};

/**
 * Emit a sphere state change to a specific socket (or all clients).
 * @param {import('socket.io').Socket|import('socket.io').Server} target
 * @param {keyof typeof SPHERE_STATES} state
 * @param {object} [meta]
 */
function emitSphereState(target, state, meta = {}) {
  target.emit('jarvis:sphere-state', { state, ...meta });
}

/**
 * Initialize all Socket.IO event handlers.
 * @param {import('socket.io').Server} io
 */
export function initSocketService(io) {
  // Track agent activity across all sessions
  const agentStates = {
    '@aiox-master': 'idle',
    '@analyst': 'idle',
    '@pm': 'idle',
    '@po': 'idle',
    '@architect': 'idle',
    '@ux-expert': 'idle',
    '@sm': 'idle',
    '@dev': 'idle',
    '@qa': 'idle',
    '@devops': 'idle',
  };

  io.on('connection', (socket) => {
    console.log(`[Socket] Client connected: ${socket.id}`);

    // Send current state on connection
    emitSphereState(socket, SPHERE_STATES.IDLE);
    socket.emit('jarvis:agent-states', agentStates);

    // ─── Main chat message (streaming) ───────────────────────────────
    socket.on('jarvis:message', async (data) => {
      const { message, sessionId } = data;

      try {
        // → Sphere: THINKING (memória carregada, aguardando 1º token)
        emitSphereState(socket, SPHERE_STATES.THINKING, { sessionId });

        let firstChunk = true;
        const response = await streamMessage(
          { message, sessionId },
          (chunk) => {
            // Na chegada do 1º token → esfera muda para SPEAKING
            if (firstChunk) {
              firstChunk = false;
              emitSphereState(socket, SPHERE_STATES.SPEAKING, { sessionId });
            }
            // Emite cada delta de texto para o frontend
            socket.emit('jarvis:stream-chunk', { chunk, sessionId });
          }
        );

        // Stream concluído — envia o payload final completo
        socket.emit('jarvis:reply', response);

        setTimeout(() => emitSphereState(socket, SPHERE_STATES.IDLE), 3000);

      } catch (error) {
        console.error('[Socket] AI error:', error.message);
        emitSphereState(socket, SPHERE_STATES.ERROR);
        socket.emit('jarvis:error', { error: 'Failed to process message' });
        setTimeout(() => emitSphereState(socket, SPHERE_STATES.IDLE), 4000);
      }
    });

    // ─── Agent status updates ─────────────────────────────────────────
    socket.on('agent:status', (data) => {
      const { agent, status } = data;

      if (agentStates.hasOwnProperty(agent)) {
        agentStates[agent] = status;
      }

      // Broadcast agent state change to all clients
      io.emit('jarvis:agent-update', { agent, status, timestamp: new Date().toISOString() });

      // If any agent is active, push sphere to THINKING
      const anyActive = Object.values(agentStates).some((s) => s === 'active');
      emitSphereState(io, anyActive ? SPHERE_STATES.THINKING : SPHERE_STATES.IDLE);
    });

    // ─── Client requests current agent states ─────────────────────────
    socket.on('jarvis:get-agent-states', () => {
      socket.emit('jarvis:agent-states', agentStates);
    });

    // ─── Manual sphere state override (admin/debug) ───────────────────
    socket.on('jarvis:set-sphere-state', ({ state }) => {
      if (Object.values(SPHERE_STATES).includes(state)) {
        io.emit('jarvis:sphere-state', { state });
      }
    });

    socket.on('disconnect', () => {
      console.log(`[Socket] Client disconnected: ${socket.id}`);
    });
  });
}
