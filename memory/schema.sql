-- ================================================================
-- JARVIS Memory Schema — Supabase
-- Cole este SQL no SQL Editor do seu projeto Supabase e execute
-- ================================================================

-- ── 1. CONVERSAS — histórico completo de mensagens ──────────────
CREATE TABLE IF NOT EXISTS conversas (
  id           UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id   TEXT NOT NULL,
  role         TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content      TEXT NOT NULL,
  tokens_used  INT DEFAULT 0,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_conversas_session ON conversas(session_id);
CREATE INDEX IF NOT EXISTS idx_conversas_created ON conversas(created_at DESC);

-- ── 2. PERFIL_USUARIO — quem é o usuário ────────────────────────
CREATE TABLE IF NOT EXISTS perfil_usuario (
  id               UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  nome             TEXT NOT NULL DEFAULT 'Moniel',
  empresas         JSONB DEFAULT '["Zaltryon", "MonieTech"]',
  preferencias     JSONB DEFAULT '{}',
  estilo_trabalho  TEXT,
  objetivos        TEXT[],
  updated_at       TIMESTAMPTZ DEFAULT NOW()
);
-- Inserir perfil inicial
INSERT INTO perfil_usuario (nome, empresas, estilo_trabalho, objetivos)
VALUES (
  'Moniel',
  '["Zaltryon (SaaS)", "MonieTech (Loja e Assistência Técnica)"]',
  'Direto ao ponto, estratégico, prefere respostas concisas e acionáveis.',
  ARRAY['Escalar Zaltryon', 'Otimizar operações da MonieTech', 'Construir JARVIS como assistente pessoal']
)
ON CONFLICT DO NOTHING;

-- ── 3. FATOS — conhecimento persistente sobre o usuário/projetos ─
CREATE TABLE IF NOT EXISTS fatos (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  categoria   TEXT NOT NULL DEFAULT 'geral',
  conteudo    TEXT NOT NULL,
  tags        TEXT[] DEFAULT '{}',
  relevancia  INT DEFAULT 5 CHECK (relevancia BETWEEN 1 AND 10),
  origem      TEXT DEFAULT 'manual',  -- 'manual' | 'auto-extraido' | 'agente'
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_fatos_categoria ON fatos(categoria);
CREATE INDEX IF NOT EXISTS idx_fatos_tags ON fatos USING GIN(tags);

-- Fatos iniciais
INSERT INTO fatos (categoria, conteudo, tags, relevancia) VALUES
  ('negocio', 'Moniel gerencia a Zaltryon, uma empresa SaaS em crescimento.', ARRAY['zaltryon', 'saas', 'negocio'], 10),
  ('negocio', 'Moniel gerencia a MonieTech, loja e assistência técnica de celular e computador.', ARRAY['monietech', 'loja', 'assistencia'], 10),
  ('preferencia', 'Prefere respostas diretas, estratégicas e sem rodeios.', ARRAY['comunicacao', 'estilo'], 9),
  ('projeto', 'JARVIS é o assistente pessoal de IA sendo construído com Claude + React + Three.js.', ARRAY['jarvis', 'projeto', 'ia'], 9)
ON CONFLICT DO NOTHING;

-- ── 4. PROJETOS — projetos ativos com contexto ──────────────────
CREATE TABLE IF NOT EXISTS projetos (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  nome        TEXT NOT NULL,
  empresa     TEXT,
  status      TEXT DEFAULT 'ativo' CHECK (status IN ('ativo', 'pausado', 'concluido', 'cancelado')),
  descricao   TEXT,
  contexto    TEXT,
  prioridade  INT DEFAULT 5 CHECK (prioridade BETWEEN 1 AND 10),
  tags        TEXT[] DEFAULT '{}',
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_projetos_status ON projetos(status);

-- Projetos iniciais
INSERT INTO projetos (nome, empresa, status, descricao, prioridade) VALUES
  ('JARVIS AI Assistant', 'Pessoal', 'ativo', 'Construção do assistente pessoal de IA com orquestração de agentes.', 10),
  ('Zaltryon SaaS', 'Zaltryon', 'ativo', 'Plataforma SaaS em desenvolvimento/crescimento.', 9),
  ('MonieTech Operações', 'MonieTech', 'ativo', 'Gestão da loja e assistência técnica.', 8)
ON CONFLICT DO NOTHING;

-- ── 5. DECISOES — decisões importantes tomadas com o JARVIS ─────
CREATE TABLE IF NOT EXISTS decisoes (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  titulo      TEXT NOT NULL,
  descricao   TEXT NOT NULL,
  contexto    TEXT,
  resultado   TEXT,
  projeto_id  UUID REFERENCES projetos(id),
  tags        TEXT[] DEFAULT '{}',
  created_at  TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_decisoes_projeto ON decisoes(projeto_id);

-- ── 6. ENTREGAVEIS_AGENTES — saídas dos agentes AIOS ────────────
CREATE TABLE IF NOT EXISTS entregaveis_agentes (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  agente      TEXT NOT NULL,
  tipo        TEXT NOT NULL DEFAULT 'texto',  -- 'texto' | 'codigo' | 'documento' | 'plano'
  titulo      TEXT,
  conteudo    TEXT NOT NULL,
  session_id  TEXT,
  projeto_id  UUID REFERENCES projetos(id),
  metadata    JSONB DEFAULT '{}',
  created_at  TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_entregaveis_agente ON entregaveis_agentes(agente);
CREATE INDEX IF NOT EXISTS idx_entregaveis_session ON entregaveis_agentes(session_id);

-- ── Desabilitar RLS para uso interno (backend com service key) ───
-- Se preferir RLS, configure políticas por projeto
ALTER TABLE conversas           DISABLE ROW LEVEL SECURITY;
ALTER TABLE perfil_usuario      DISABLE ROW LEVEL SECURITY;
ALTER TABLE fatos                DISABLE ROW LEVEL SECURITY;
ALTER TABLE projetos            DISABLE ROW LEVEL SECURITY;
ALTER TABLE decisoes            DISABLE ROW LEVEL SECURITY;
ALTER TABLE entregaveis_agentes DISABLE ROW LEVEL SECURITY;
