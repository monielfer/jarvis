import Anthropic from '@anthropic-ai/sdk';

import { AioxMasterAgent } from '../definitions/AioxMasterAgent.js';
import { AnalystAgent } from '../definitions/AnalystAgent.js';
import { PmAgent } from '../definitions/PmAgent.js';
import { PoAgent } from '../definitions/PoAgent.js';
import { ArchitectAgent } from '../definitions/ArchitectAgent.js';
import { UxExpertAgent } from '../definitions/UxExpertAgent.js';
import { SmAgent } from '../definitions/SmAgent.js';
import { DevAgent } from '../definitions/DevAgent.js';
import { QaAgent } from '../definitions/QaAgent.js';
import { DevopsAgent } from '../definitions/DevopsAgent.js';

/**
 * AgentRunner — JARVIS's cognitive orchestration engine.
 *
 * Flow:
 *  1. @aiox-master analyzes the request → produces a routing plan
 *  2. AgentRunner dispatches to specialist agents (parallel or sequential)
 *  3. Each agent calls Claude with its domain system prompt
 *  4. Results are aggregated and returned to JARVIS
 */
export class AgentRunner {
  constructor() {
    this._client = null; // lazy — created on first API call
    this.model = process.env.AGENT_MODEL || 'claude-sonnet-4-6';

    // Registry of all specialist agents
    this.registry = {
      '@aiox-master': new AioxMasterAgent(),
      '@analyst': new AnalystAgent(),
      '@pm': new PmAgent(),
      '@po': new PoAgent(),
      '@architect': new ArchitectAgent(),
      '@ux-expert': new UxExpertAgent(),
      '@sm': new SmAgent(),
      '@dev': new DevAgent(),
      '@qa': new QaAgent(),
      '@devops': new DevopsAgent(),
    };

    console.log(`[AgentRunner] ${Object.keys(this.registry).length} agents registered`);
  }

  /**
   * Main entry point — run a task through the agent system.
   *
   * If agentName is specified, route directly to that agent.
   * Otherwise, let @aiox-master decide the routing plan.
   *
   * @param {{ task: string, agentName?: string, context?: object, storyData?: object }} input
   * @returns {Promise<AgentRunResult>}
   */
  async run({ task, agentName, context = {}, storyData }) {
    console.log(`[AgentRunner] Task: "${task.slice(0, 80)}..." → ${agentName || '@aiox-master'}`);

    if (agentName) {
      return this._runSingleAgent({ agentName, task, context, storyData });
    }

    return this._runOrchestrated({ task, context });
  }

  /**
   * Run a single named agent directly.
   */
  async _runSingleAgent({ agentName, task, context, storyData }) {
    const agent = this.registry[agentName];
    if (!agent) {
      throw new Error(`Unknown agent: ${agentName}. Available: ${Object.keys(this.registry).join(', ')}`);
    }

    const agentInput = await agent.execute({ task, context, storyData });
    const response = await this._callClaude({
      systemPrompt: agentInput.systemPrompt,
      task,
      context: { ...context, storyFile: agentInput.storyFile },
    });

    agent.status = 'idle';

    return {
      mode: 'direct',
      agent: agentName,
      task,
      response,
      storyFile: agentInput.storyFile || null,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Let @aiox-master analyze the task and orchestrate multiple agents.
   */
  async _runOrchestrated({ task, context }) {
    // Step 1: @aiox-master produces a routing plan
    const masterAgent = this.registry['@aiox-master'];
    const masterInput = await masterAgent.execute({ task, context });

    const planResponse = await this._callClaude({
      systemPrompt: masterInput.systemPrompt,
      task,
      context,
      responseFormat: 'json',
    });

    let plan;
    try {
      plan = JSON.parse(planResponse);
    } catch {
      // If master doesn't return valid JSON, fall back to direct response
      return {
        mode: 'orchestrated',
        plan: null,
        results: [{ agent: '@aiox-master', response: planResponse }],
        timestamp: new Date().toISOString(),
      };
    }

    console.log(`[AgentRunner] Plan: ${plan.complexity} complexity, ${plan.agents?.length} agents`);

    // Step 2: Execute agents according to plan
    const agentTasks = (plan.agents || []).map((a) => ({
      agentName: a.agent,
      task: a.task || task,
      priority: a.priority,
    }));

    let results;
    if (plan.parallel) {
      results = await Promise.all(
        agentTasks.map((a) =>
          this._runSingleAgent({ agentName: a.agentName, task: a.task, context })
            .catch((err) => ({ agent: a.agentName, error: err.message }))
        )
      );
    } else {
      results = [];
      for (const a of agentTasks) {
        const result = await this._runSingleAgent({
          agentName: a.agentName,
          task: a.task,
          context: { ...context, previousResults: results },
        }).catch((err) => ({ agent: a.agentName, error: err.message }));
        results.push(result);
      }
    }

    // Step 3: Synthesize if needed
    let synthesis = null;
    if (plan.synthesize && results.length > 1) {
      synthesis = await this._synthesize({ task, plan, results });
    }

    return {
      mode: 'orchestrated',
      plan,
      results,
      synthesis,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Synthesize multiple agent results into a cohesive response.
   */
  async _synthesize({ task, plan, results }) {
    const context = results
      .map((r) => `### ${r.agent}\n${r.response || r.error || 'No response'}`)
      .join('\n\n');

    const synthesisPrompt = `You are @aiox-master synthesizing specialist input into a unified response.

Original task: ${task}
Intent: ${plan.intent}

Specialist outputs:
${context}

Synthesize the above into a single, cohesive, actionable response.
Eliminate redundancy. Highlight conflicts. Prioritize actionable insights.`;

    return this._callClaude({
      systemPrompt: synthesisPrompt,
      task: 'Synthesize the specialist outputs into a unified response.',
      context: {},
    });
  }

  /**
   * Call Claude API with a given system prompt and task.
   * @param {{ systemPrompt: string, task: string, context: object, responseFormat?: string }} params
   */
  async _callClaude({ systemPrompt, task, context = {}, responseFormat }) {
    const userMessage = context && Object.keys(context).length > 0
      ? `${task}\n\n<context>${JSON.stringify(context, null, 2)}</context>`
      : task;

    const extraInstructions = responseFormat === 'json'
      ? '\n\nIMPORTANT: Respond ONLY with valid JSON. No markdown, no explanation.'
      : '';

    if (!this._client) this._client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const response = await this._client.messages.create({
      model: this.model,
      max_tokens: 2048,
      system: systemPrompt + extraInstructions,
      messages: [{ role: 'user', content: userMessage }],
    });

    return response.content[0].text;
  }

  /**
   * Get status of all registered agents.
   */
  getStatus() {
    return Object.values(this.registry).map((a) => a.toJSON());
  }

  /**
   * Get a specific agent by name.
   * @param {string} name
   */
  getAgent(name) {
    return this.registry[name] || null;
  }
}

/**
 * @typedef {Object} AgentRunResult
 * @property {'direct'|'orchestrated'} mode
 * @property {string} [agent] - for direct mode
 * @property {object} [plan] - for orchestrated mode
 * @property {string} [response] - for direct mode
 * @property {Array} [results] - for orchestrated mode
 * @property {string} [synthesis] - synthesized response for orchestrated mode
 * @property {object} [storyFile] - if @sm created a Story File
 * @property {string} timestamp
 */
