import React from 'react';

const AGENTS = [
  { id: '@aiox-master', label: 'MASTER',    icon: '◈' },
  { id: '@analyst',     label: 'ANALYST',   icon: '◉' },
  { id: '@pm',          label: 'PM',        icon: '◈' },
  { id: '@po',          label: 'PO',        icon: '◎' },
  { id: '@architect',   label: 'ARCHITECT', icon: '⬡' },
  { id: '@ux-expert',   label: 'UX',        icon: '◐' },
  { id: '@sm',          label: 'SCRUM',     icon: '◑' },
  { id: '@dev',         label: 'DEV',       icon: '⟨/⟩' },
  { id: '@qa',          label: 'QA',        icon: '◇' },
  { id: '@devops',      label: 'DEVOPS',    icon: '⚙' },
];

const STATUS_CONFIG = {
  idle:    { color: 'var(--color-muted)',   glow: 'none',                        label: 'IDLE'   },
  active:  { color: 'var(--color-primary)', glow: '0 0 8px var(--color-primary)', label: 'ACTIVE' },
  error:   { color: '#ff1744',              glow: '0 0 8px #ff1744',              label: 'ERR'    },
  done:    { color: '#00e676',              glow: '0 0 6px #00e676',              label: 'DONE'   },
};

function AgentRow({ agent, status = 'idle' }) {
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.idle;
  const isActive = status === 'active';

  return (
    <div className={`hud-agent-row ${isActive ? 'hud-agent-row--active' : ''}`}>
      <span
        className="hud-agent-icon"
        style={{ color: cfg.color, textShadow: cfg.glow }}
      >
        {agent.icon}
      </span>

      <div className="hud-agent-info">
        <span className="hud-agent-name">{agent.label}</span>
        <span className="hud-agent-id">{agent.id}</span>
      </div>

      <span
        className="hud-agent-status"
        style={{ color: cfg.color }}
      >
        {cfg.label}
      </span>

      {isActive && <span className="hud-agent-pulse" />}
    </div>
  );
}

/**
 * AgentHUD — lateral panel showing the status of all JARVIS specialist agents.
 * @param {{ agentStates: object, connected: boolean }} props
 */
export default function AgentHUD({ agentStates = {}, connected = false }) {
  const activeCount = Object.values(agentStates).filter((s) => s === 'active').length;

  return (
    <aside className="hud-panel">
      {/* Header */}
      <div className="hud-header">
        <span className="hud-title">AGENT MATRIX</span>
        <div className="hud-connection">
          <span
            className="hud-dot"
            style={{ background: connected ? 'var(--color-primary)' : '#ff1744' }}
          />
          <span className="hud-connection-label">
            {connected ? 'ONLINE' : 'OFFLINE'}
          </span>
        </div>
      </div>

      {/* Divider */}
      <div className="hud-divider" />

      {/* Active count */}
      <div className="hud-stat">
        <span className="hud-stat-label">ACTIVE</span>
        <span className="hud-stat-value">{activeCount} / {AGENTS.length}</span>
      </div>

      <div className="hud-divider" />

      {/* Agent list */}
      <div className="hud-agent-list">
        {AGENTS.map((agent) => (
          <AgentRow
            key={agent.id}
            agent={agent}
            status={agentStates[agent.id] || 'idle'}
          />
        ))}
      </div>

      {/* Footer */}
      <div className="hud-divider" />
      <div className="hud-footer">
        <span>JARVIS v1.0</span>
        <span>ZALTRYON · MONIETECH</span>
      </div>
    </aside>
  );
}
