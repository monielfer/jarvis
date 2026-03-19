import Anthropic from '@anthropic-ai/sdk';
import {
  buildContextoMemoria,
  salvarMensagem,
  extrairEsalvarFatos,
} from '../../../memory/memoryService.js';
import { AgentRunner } from '../../../agents/orchestrator/agentRunner.js';

// ── Lazy clients ───────────────────────────────────────────────────────────────
let _client = null;
let _runner = null;
const getClient = () => {
  if (!_client) _client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  return _client;
};
const getRunner = () => {
  if (!_runner) _runner = new AgentRunner();
  return _runner;
};

// ── JARVIS Tool Use — Claude decide quando chamar qual agente ──────────────────
const JARVIS_TOOLS = [
  {
    name: 'call_specialist_agent',
    description: `Delegate a task to a JARVIS specialist agent. Use when the request needs deep domain expertise:
- Code / implementation / debugging → @dev
- Business analysis / requirements / user stories → @analyst
- Technical architecture / system design → @architect
- Project timelines / risk / resources → @pm
- Product backlog / prioritization / PRD → @po
- UX/UI / wireframes / user flows → @ux-expert
- Scrum / sprint planning / Story Files → @sm
- Test plans / QA / bug reports → @qa
- CI/CD / infrastructure / deployment → @devops
Do NOT call an agent for simple factual questions or business strategy answers you can handle directly.`,
    input_schema: {
      type: 'object',
      properties: {
        agent: {
          type: 'string',
          enum: ['@dev', '@analyst', '@architect', '@pm', '@po', '@ux-expert', '@sm', '@qa', '@devops'],
          description: 'Specialist agent to call',
        },
        task: {
          type: 'string',
          description: 'Complete, self-contained task description for the agent',
        },
      },
      required: ['agent', 'task'],
    },
  },
];

const BASE_SYSTEM_PROMPT = `You are JARVIS (Just A Rather Very Intelligent System) — the personal AI assistant and strategic operating system of Moniel.

## Your Owner's Context
Moniel manages two businesses:

**Zaltryon** — A SaaS company. You help with product strategy, feature prioritization, SaaS metrics (MRR, churn, LTV, CAC), roadmap decisions, customer success, and B2B growth tactics.

**MonieTech** — A mobile phone and computer store with technical repair services. You help with inventory management, repair workflow, pricing strategy, customer acquisition, local marketing, and operational efficiency.

## Your Personality
- **Direct**: No filler. Lead with the answer, then context only if needed.
- **Strategic**: Always consider second-order effects and business impact.
- **Calm**: Never panic, never hedge excessively. Present options when uncertain.
- **Precise**: Numbers, names, and facts — get them right or say you don't know.

## Behavioral Rules
1. When asked about Zaltryon, always think SaaS-first: scalability, automation, product-led growth.
2. When asked about MonieTech, think operations-first: margins, throughput, local reputation, upsells.
3. If the request involves both businesses, separate the analysis clearly.
4. Delegate complex technical tasks to the specialist agents via the call_specialist_agent tool.
5. Never pad responses. If the answer is one sentence, give one sentence.
6. Refer to Moniel directly — not "the user" or "you".
7. You have persistent memory — use it. Reference past conversations and known facts naturally.

## Agent Orchestration
Use call_specialist_agent when Moniel asks about: code, architecture, project plans, product backlog, UX design, QA, DevOps, or sprint planning. For everything else, answer directly.`;

// ── Shared context builder ─────────────────────────────────────────────────────
async function _buildPromptAndSaveUser(message, sessionId, context) {
  const sid = sessionId || crypto.randomUUID();

  let memoriaContext = '';
  try {
    memoriaContext = await buildContextoMemoria(sid);
  } catch (err) {
    console.warn('[aiService] Memory load failed:', err.message);
  }

  const systemPrompt = BASE_SYSTEM_PROMPT + memoriaContext;
  const userContent = Object.keys(context).length > 0
    ? `${message}\n\n<context>${JSON.stringify(context)}</context>`
    : message;

  salvarMensagem({ sessionId: sid, role: 'user', content: message }).catch(() => {});
  return { sid, systemPrompt, userContent };
}

function _backgroundFlush(sid, reply, usage) {
  salvarMensagem({
    sessionId: sid,
    role: 'assistant',
    content: reply,
    tokensUsed: usage?.output_tokens || 0,
  }).catch(() => {});
  extrairEsalvarFatos(reply, getClient()).catch(() => {});
}

// ── processMessage (bloqueante, mantido para compatibilidade) ──────────────────
export async function processMessage({ message, sessionId, context = {} }) {
  const { sid, systemPrompt, userContent } = await _buildPromptAndSaveUser(
    message, sessionId, context
  );

  const response = await getClient().messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 1024,
    system: systemPrompt,
    messages: [{ role: 'user', content: userContent }],
  });

  const reply = response.content[0]?.text || '';
  _backgroundFlush(sid, reply, response.usage);
  return { sessionId: sid, reply, usage: response.usage, timestamp: new Date().toISOString() };
}

/**
 * streamMessage — streaming com Tool Use.
 *
 * Fluxo:
 *  1. Claude streama resposta com tools disponíveis
 *  2. Se stop_reason === 'tool_use' → executa agente especialista
 *  3. Injeta tool_result e streama a resposta final
 *  4. Supabase + extração de fatos rodam em background
 */
export async function streamMessage({ message, sessionId, context = {} }, onChunk) {
  const { sid, systemPrompt, userContent } = await _buildPromptAndSaveUser(
    message, sessionId, context
  );

  let fullReply = '';
  let messages   = [{ role: 'user', content: userContent }];

  // Loop — máximo 2 voltas (1 com tool_use + 1 resposta final)
  for (let turn = 0; turn < 2; turn++) {
    const stream = getClient().messages.stream({
      model:      'claude-sonnet-4-6',
      max_tokens: 2048,
      system:     systemPrompt,
      messages,
      tools:      JARVIS_TOOLS,
    });

    // Streama texto imediatamente para o cliente
    stream.on('text', (text) => {
      fullReply += text;
      onChunk(text);
    });

    const final = await stream.finalMessage();

    // Se não houve tool_use, terminou
    if (final.stop_reason !== 'tool_use') break;

    // ── Executa cada tool call ────────────────────────────────────────────────
    const toolResults = [];
    for (const block of final.content) {
      if (block.type !== 'tool_use') continue;

      const { agent: agentName, task } = block.input;
      console.log(`[aiService] → ${agentName}: "${task.slice(0, 60)}..."`);

      try {
        const agentResult = await getRunner().run({ agentName, task, context });
        const content = agentResult.response || agentResult.synthesis
          || JSON.stringify(agentResult, null, 2);
        toolResults.push({ type: 'tool_result', tool_use_id: block.id, content });
      } catch (err) {
        toolResults.push({
          type: 'tool_result',
          tool_use_id: block.id,
          content: `Agent error: ${err.message}`,
          is_error: true,
        });
      }
    }

    // Próxima volta: adiciona turno do assistente + resultados das tools
    messages = [
      ...messages,
      { role: 'assistant', content: final.content },
      { role: 'user',      content: toolResults },
    ];
  }

  _backgroundFlush(sid, fullReply, null);
  return { sessionId: sid, reply: fullReply, timestamp: new Date().toISOString() };
}

export { BASE_SYSTEM_PROMPT as SYSTEM_PROMPT };
