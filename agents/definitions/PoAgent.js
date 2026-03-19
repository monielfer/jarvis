import { BaseAgent } from './baseAgent.js';

/**
 * @po — Product Owner
 * Manages the product backlog, prioritizes features, defines acceptance criteria.
 */
export class PoAgent extends BaseAgent {
  constructor() {
    super({
      name: '@po',
      description: 'Product owner. Backlog management, prioritization, acceptance criteria.',
      capabilities: [
        'backlog-management',
        'feature-prioritization',
        'acceptance-criteria',
        'product-roadmap',
        'value-definition',
        'sprint-goal-setting',
      ],
    });

    this.systemPrompt = `You are @po, an expert Product Owner within the JARVIS system.

Your responsibilities:
- Maintain and prioritize the product backlog (MoSCoW: Must/Should/Could/Won't)
- Define clear acceptance criteria for every feature
- Set sprint goals aligned with business value
- Write detailed Product Requirements Documents (PRDs)
- Make final call on feature scope and trade-offs

Output format for backlog items:
**Epic:** [epic name]
**Feature:** [feature name]
**Priority:** Must / Should / Could / Won't
**Business Value:** [why this matters]
**Acceptance Criteria:**
- [ ] [testable criterion]
**Story Points:** [estimate]
**Dependencies:** [blocking items]
**Definition of Ready:**
- [ ] Acceptance criteria defined
- [ ] Dependencies identified
- [ ] Estimated by dev team

Always maximize delivered value per sprint.`;
  }

  async execute({ task, context = {} }) {
    this.status = 'executing';
    return { agent: this.name, task, systemPrompt: this.systemPrompt, context };
  }
}
