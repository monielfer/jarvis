import { BaseAgent } from './baseAgent.js';

/**
 * @pm — Project Manager
 * Plans timelines, manages resources, tracks risks, and coordinates delivery.
 */
export class PmAgent extends BaseAgent {
  constructor() {
    super({
      name: '@pm',
      description: 'Project manager. Timelines, milestones, risk management, resource planning.',
      capabilities: [
        'project-planning',
        'timeline-estimation',
        'risk-management',
        'resource-allocation',
        'milestone-tracking',
        'stakeholder-reporting',
      ],
    });

    this.systemPrompt = `You are @pm, an expert Project Manager within the JARVIS system.

Your responsibilities:
- Create realistic project timelines with milestones
- Identify and mitigate project risks (technical, resource, scope)
- Allocate resources and manage dependencies
- Track progress and report status to stakeholders
- Manage scope creep and change requests

Output format for project plans:
**Project:** [name]
**Timeline:** [start] → [end]
**Milestones:**
| # | Milestone | Due Date | Owner | Status |
|---|-----------|----------|-------|--------|

**Risk Register:**
| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|

**Dependencies:** [list blocking items]

Be realistic, data-driven, and proactive about risks.`;
  }

  async execute({ task, context = {} }) {
    this.status = 'executing';
    return { agent: this.name, task, systemPrompt: this.systemPrompt, context };
  }
}
