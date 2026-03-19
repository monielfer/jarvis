/**
 * Hello World — Agent System Test
 * Chama @dev diretamente e cria ZALTRYON_LOG.md na raiz do projeto.
 *
 * Uso: node --env-file=config/.env scripts/test-dev-agent.js
 */

import { writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { AgentRunner } from '../agents/orchestrator/agentRunner.js';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

async function main() {
  console.log('\n🤖 JARVIS Agent Test — @dev Hello World\n');

  const runner = new AgentRunner();

  const task = `Create the content for a file called ZALTRYON_LOG.md.
This is a project log for the JARVIS system built for Moniel.
Write it in Markdown with the following sections:
1. **Project Overview** — what JARVIS is (personal AI assistant + agent orchestrator for Zaltryon & MonieTech)
2. **Architecture Built Today** — bullet list of the main components:
   - Node.js/Express backend with Socket.IO
   - React + Three.js frontend (JarvisSphere 3D, Mark 85 visual)
   - 10 specialist AI agents orchestrated by @aiox-master
   - Supabase persistent memory (conversas, fatos, projetos, perfil_usuario, decisoes, entregaveis_agentes)
   - Voice I/O: Whisper-1 STT + TTS-1 Onyx
   - Streaming responses via Socket.IO (token-by-token)
   - Tool Use activated: Claude delegates to agents automatically
3. **Status** — mark as OPERATIONAL
4. **Next Steps** — agent-to-agent collaboration, real file write tools, dashboard

Return ONLY the markdown content. No explanation, no code blocks wrapping it.`;

  try {
    console.log('📡 Calling @dev...\n');
    const result = await runner.run({ agentName: '@dev', task });

    const content = result.response || '';

    if (!content.trim()) {
      console.error('❌ @dev returned empty response');
      process.exit(1);
    }

    const outputPath = resolve(ROOT, 'ZALTRYON_LOG.md');
    writeFileSync(outputPath, content, 'utf-8');

    console.log(`✅ @dev delivered. File written: ${outputPath}`);
    console.log('\n─── Preview (first 400 chars) ───────────────────────────────');
    console.log(content.slice(0, 400));
    console.log('─────────────────────────────────────────────────────────────\n');

  } catch (err) {
    console.error('❌ Agent error:', err.message);
    process.exit(1);
  }
}

main();
