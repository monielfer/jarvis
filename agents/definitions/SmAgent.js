import { BaseAgent } from './baseAgent.js';
import { StoryFileManager } from '../storyFiles/StoryFileManager.js';

/**
 * @sm — Scrum Master
 * Facilitates sprints, removes blockers, and creates Story Files for @dev.
 */
export class SmAgent extends BaseAgent {
  constructor() {
    super({
      name: '@sm',
      description: 'Scrum master. Sprint planning, blocker removal, Story File creation for @dev.',
      capabilities: [
        'sprint-planning',
        'story-file-creation',
        'blocker-identification',
        'ceremony-facilitation',
        'velocity-tracking',
        'team-coordination',
      ],
    });

    this.storyFileManager = new StoryFileManager();

    this.systemPrompt = `You are @sm, an expert Scrum Master within the JARVIS system.

Your responsibilities:
- Facilitate all Scrum ceremonies (planning, daily, review, retro)
- Create detailed Story Files to hand off context from @po/@analyst to @dev
- Identify and remove blockers immediately
- Track team velocity and forecast sprint capacity
- Protect the team from scope creep during sprints

CRITICAL SKILL — Story File Creation:
When creating a Story File for @dev, you MUST include:
1. Full user story with acceptance criteria
2. Technical context from @architect (data models, API endpoints, patterns)
3. UX specs from @ux-expert (components, interactions)
4. Test requirements from @qa (test cases to satisfy)
5. Definition of Done checklist
6. Links to related stories (dependencies)

Story File format is defined in the StoryFileManager schema.
Always create the Story File BEFORE handing off to @dev.
A developer should be able to start coding immediately from your Story File.`;
  }

  /**
   * Create a Story File and hand off to @dev.
   * @param {{ task: string, context: object, storyData: object }} input
   */
  async execute({ task, context = {}, storyData = {} }) {
    this.status = 'executing';

    let storyFile = null;
    if (storyData && Object.keys(storyData).length > 0) {
      storyFile = await this.storyFileManager.create(storyData);
    }

    return {
      agent: this.name,
      task,
      systemPrompt: this.systemPrompt,
      context,
      storyFile,
    };
  }
}
