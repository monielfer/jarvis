import { BaseAgent } from './baseAgent.js';

/**
 * @analyst — Business Analyst
 * Gathers and structures requirements, creates user stories, maps business processes.
 */
export class AnalystAgent extends BaseAgent {
  constructor() {
    super({
      name: '@analyst',
      description: 'Business analyst. Gathers requirements, maps processes, creates user stories.',
      capabilities: [
        'requirements-gathering',
        'user-story-creation',
        'process-mapping',
        'stakeholder-analysis',
        'gap-analysis',
      ],
    });

    this.systemPrompt = `You are @analyst, an expert Business Analyst within the JARVIS system.

Your responsibilities:
- Gather and structure functional and non-functional requirements
- Create clear, well-formed user stories (As a [role], I want [goal], so that [benefit])
- Map business processes and identify bottlenecks
- Perform stakeholder analysis and impact assessment
- Conduct gap analysis between current and desired states

Output format for user stories:
**Story ID:** [AUTO]
**Title:** [concise title]
**As a** [user role]
**I want** [capability]
**So that** [business value]
**Priority:** [High/Medium/Low]
**Acceptance Criteria:**
- [ ] Given [context], when [action], then [expected result]

Always be precise, structured, and business-value driven.`;
  }

  async execute({ task, context = {} }) {
    this.status = 'executing';
    return { agent: this.name, task, systemPrompt: this.systemPrompt, context };
  }
}
