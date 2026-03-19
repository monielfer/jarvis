import { createClient } from '@supabase/supabase-js';

// Use service key for backend — bypasses RLS
function getClient() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY;
  if (!url || !key) {
    console.warn('[Memory] Supabase not configured — memory disabled.');
    return null;
  }
  return createClient(url, key);
}

let _db = null;
const db = () => {
  if (!_db) _db = getClient();
  return _db;
};

// ── Conversas ──────────────────────────────────────────────────────────────

export async function salvarMensagem({ sessionId, role, content, tokensUsed = 0 }) {
  if (!db()) return null;
  const { error } = await db().from('conversas').insert({
    session_id: sessionId,
    role,
    content,
    tokens_used: tokensUsed,
  });
  if (error) console.error('[Memory] salvarMensagem:', error.message);
}

export async function getHistoricoRecente(sessionId, limite = 10) {
  if (!db()) return [];
  const { data, error } = await db()
    .from('conversas')
    .select('role, content, created_at')
    .eq('session_id', sessionId)
    .order('created_at', { ascending: false })
    .limit(limite);
  if (error) { console.error('[Memory] getHistoricoRecente:', error.message); return []; }
  return (data || []).reverse(); // cronológico
}

export async function getHistoricoGlobal(limite = 5) {
  if (!db()) return [];
  const { data, error } = await db()
    .from('conversas')
    .select('role, content, created_at, session_id')
    .order('created_at', { ascending: false })
    .limit(limite);
  if (error) { console.error('[Memory] getHistoricoGlobal:', error.message); return []; }
  return (data || []).reverse();
}

// ── Perfil ─────────────────────────────────────────────────────────────────

export async function getPerfil() {
  if (!db()) return null;
  const { data, error } = await db()
    .from('perfil_usuario')
    .select('*')
    .limit(1)
    .single();
  if (error) { console.error('[Memory] getPerfil:', error.message); return null; }
  return data;
}

// ── Fatos ──────────────────────────────────────────────────────────────────

export async function getFatosRelevantes(limite = 15) {
  if (!db()) return [];
  const { data, error } = await db()
    .from('fatos')
    .select('categoria, conteudo, tags, relevancia')
    .order('relevancia', { ascending: false })
    .limit(limite);
  if (error) { console.error('[Memory] getFatosRelevantes:', error.message); return []; }
  return data || [];
}

export async function salvarFato({ categoria, conteudo, tags = [], relevancia = 5, origem = 'auto-extraido' }) {
  if (!db()) return null;
  // Evita duplicatas exatas
  const { data: existe } = await db()
    .from('fatos')
    .select('id')
    .eq('conteudo', conteudo)
    .limit(1);
  if (existe?.length > 0) return null;

  const { error } = await db().from('fatos').insert({ categoria, conteudo, tags, relevancia, origem });
  if (error) console.error('[Memory] salvarFato:', error.message);
}

// ── Projetos ───────────────────────────────────────────────────────────────

export async function getProjetosAtivos() {
  if (!db()) return [];
  const { data, error } = await db()
    .from('projetos')
    .select('nome, empresa, status, descricao, prioridade')
    .eq('status', 'ativo')
    .order('prioridade', { ascending: false });
  if (error) { console.error('[Memory] getProjetosAtivos:', error.message); return []; }
  return data || [];
}

// ── Entregáveis ────────────────────────────────────────────────────────────

export async function salvarEntregavel({ agente, tipo = 'texto', titulo, conteudo, sessionId, metadata = {} }) {
  if (!db()) return null;
  const { error } = await db().from('entregaveis_agentes').insert({
    agente, tipo, titulo, conteudo,
    session_id: sessionId,
    metadata,
  });
  if (error) console.error('[Memory] salvarEntregavel:', error.message);
}

// ── Decisões ───────────────────────────────────────────────────────────────

export async function salvarDecisao({ titulo, descricao, contexto, resultado, tags = [] }) {
  if (!db()) return null;
  const { error } = await db().from('decisoes').insert({ titulo, descricao, contexto, resultado, tags });
  if (error) console.error('[Memory] salvarDecisao:', error.message);
}

// ── Contexto completo para system prompt ──────────────────────────────────

export async function buildContextoMemoria(sessionId) {
  const [perfil, fatos, projetos, historico] = await Promise.all([
    getPerfil(),
    getFatosRelevantes(12),
    getProjetosAtivos(),
    getHistoricoRecente(sessionId, 8),
  ]);

  const partes = [];

  if (perfil) {
    partes.push(`## Perfil do Usuário
Nome: ${perfil.nome}
Empresas: ${JSON.stringify(perfil.empresas)}
Estilo: ${perfil.estilo_trabalho || 'Direto e estratégico'}
Objetivos: ${(perfil.objetivos || []).join(', ')}`);
  }

  if (projetos.length > 0) {
    partes.push(`## Projetos Ativos
${projetos.map(p => `- **${p.nome}** (${p.empresa || '—'}): ${p.descricao || ''}`).join('\n')}`);
  }

  if (fatos.length > 0) {
    partes.push(`## Fatos Relevantes
${fatos.map(f => `- [${f.categoria}] ${f.conteudo}`).join('\n')}`);
  }

  if (historico.length > 0) {
    partes.push(`## Histórico Recente desta Sessão
${historico.map(h => `${h.role === 'user' ? 'Moniel' : 'JARVIS'}: ${h.content.slice(0, 200)}`).join('\n')}`);
  }

  return partes.length > 0
    ? `\n\n---\n# MEMÓRIA PERSISTENTE\n${partes.join('\n\n')}\n---`
    : '';
}

// ── Extração automática de fatos da resposta do JARVIS ────────────────────

export async function extrairEsalvarFatos(resposta, anthropicClient) {
  if (!anthropicClient || !resposta || resposta.length < 50) return;

  try {
    const extraction = await anthropicClient.messages.create({
      model: 'claude-haiku-4-5-20251001', // modelo rápido e barato para extração
      max_tokens: 512,
      system: `Você é um extrator de fatos. Analise a resposta do JARVIS e extraia APENAS fatos novos e relevantes sobre o usuário (Moniel), seus projetos ou decisões.
Responda em JSON: { "fatos": [{ "categoria": "negocio|projeto|preferencia|tecnico|decisao", "conteudo": "fato conciso", "tags": ["tag1"], "relevancia": 1-10 }] }
Se não houver fatos novos relevantes, responda: { "fatos": [] }`,
      messages: [{ role: 'user', content: `Resposta do JARVIS:\n${resposta.slice(0, 1000)}` }],
    });

    const text = extraction.content[0].text.trim();
    const json = JSON.parse(text.match(/\{[\s\S]*\}/)?.[0] || '{"fatos":[]}');

    for (const fato of (json.fatos || [])) {
      if (fato.relevancia >= 6 && fato.conteudo?.length > 10) {
        await salvarFato({ ...fato, origem: 'auto-extraido' });
      }
    }
  } catch (err) {
    // Extração falhou — não crítico
    console.debug('[Memory] extrairFatos:', err.message);
  }
}
