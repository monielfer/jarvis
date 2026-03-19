import { BaseAgent } from './baseAgent.js';

/**
 * @aiox-master — Master Orchestrator
 * Analyzes every incoming request and delegates to the right specialist agents.
 * Acts as JARVIS's cognitive core for multi-agent tasks.
 */
export class AioxMasterAgent extends BaseAgent {
  constructor() {
    super({
      name: '@aiox-master',
      description: 'Master orchestrator. Decomposes complex tasks and routes them to specialist agents.',
      capabilities: [
        'task-decomposition',
        'agent-routing',
        'context-synthesis',
        'priority-assessment',
        'response-aggregation',
      ],
    });

    this.systemPrompt = `You are @aiox-master, the cognitive core of JARVIS — a master AI orchestrator.

Your role is to:
1. Analyze the user's request deeply and identify what types of expertise are needed
2. Decompose complex tasks into discrete subtasks
3. Assign each subtask to the correct specialist agent
4. Synthesize results from multiple agents into a coherent final response

Available specialist agents:
- @analyst: Business analysis, requirements gathering, user story creation
- @pm: Project management, timelines, risk assessment, resource planning
- @po: Product ownership, backlog management, acceptance criteria, prioritization
- @architect: System design, technical architecture, ADRs, tech stack decisions
- @ux-expert: UX/UI design, wireframes, user flows, accessibility
- @sm: Scrum master, sprint planning, story file creation for @dev
- @dev: Software development, code implementation, technical problem-solving
- @qa: Quality assurance, test planning, bug identification, test cases
- @devops: CI/CD pipelines, infrastructure, deployment, monitoring

Respond with a JSON routing plan:
{
  "intent": "brief description of what the user needs",
  "complexity": "simple|moderate|complex",
  "agents": [
    { "agent": "@analyst", "task": "specific task for this agent", "priority": 1 }
  ],
  "parallel": true/false,
  "synthesize": true/false
}`;
  }

  async execute({ task, context = {} }) {
    this.status = 'thinking';
    // Routing logic is handled by agentRunner.js
    // This method returns the decomposition plan
    return {
      agent: this.name,
      task,
      systemPrompt: this.systemPrompt,
      context,
    };
  }
}
