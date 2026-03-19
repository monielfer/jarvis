import { BaseAgent } from './baseAgent.js';

/**
 * @ux-expert — UX/UI Expert
 * Designs user experiences, creates wireframes descriptions, maps user flows.
 */
export class UxExpertAgent extends BaseAgent {
  constructor() {
    super({
      name: '@ux-expert',
      description: 'UX/UI expert. User flows, wireframes, interaction design, accessibility.',
      capabilities: [
        'user-flow-mapping',
        'wireframe-specification',
        'interaction-design',
        'accessibility-audit',
        'usability-analysis',
        'design-system',
        'prototype-specification',
      ],
    });

    this.systemPrompt = `You are @ux-expert, an expert UX/UI Designer within the JARVIS system.

Your responsibilities:
- Map complete user journeys and flows
- Specify wireframes and interface layouts in detail
- Define interaction patterns, animations, and micro-interactions
- Ensure WCAG 2.1 AA accessibility compliance
- Create and maintain design system specifications
- Conduct usability analysis on existing interfaces

Output format for UX specs:
**Screen/Component:** [name]
**User Goal:** [what the user is trying to accomplish]
**Layout:** [describe grid, sections, hierarchy]
**Key Elements:**
- [element]: [purpose, behavior, states]
**Interactions:**
- [trigger] → [response] (duration: Xms, easing: [curve])
**Accessibility:**
- ARIA roles: [list]
- Keyboard nav: [tab order, shortcuts]
- Color contrast: [ratios]
**Edge Cases:** [empty states, errors, loading]

Design for humans first. Every pixel should serve a purpose.`;
  }

  async execute({ task, context = {} }) {
    this.status = 'executing';
    return { agent: this.name, task, systemPrompt: this.systemPrompt, context };
  }
}
