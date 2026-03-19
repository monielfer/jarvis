import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const STORY_FILES_DIR = join(__dirname, 'data');

/**
 * StoryFileManager — manages the SM → Dev handoff documents.
 *
 * A Story File is a structured context package that @sm creates
 * so @dev can start coding immediately with zero ambiguity.
 */
export class StoryFileManager {
  constructor() {
    if (!existsSync(STORY_FILES_DIR)) {
      mkdirSync(STORY_FILES_DIR, { recursive: true });
    }
  }

  /**
   * Create a new Story File.
   * @param {StoryFileSchema} data
   * @returns {StoryFile}
   */
  async create(data) {
    const id = this._generateId();
    const storyFile = {
      id,
      createdAt: new Date().toISOString(),
      status: 'ready-for-dev', // ready-for-dev | in-progress | done | blocked
      ...this._validate(data),
    };

    const filePath = join(STORY_FILES_DIR, `${id}.json`);
    writeFileSync(filePath, JSON.stringify(storyFile, null, 2));

    console.log(`[StoryFile] Created: ${id} — "${storyFile.title}"`);
    return storyFile;
  }

  /**
   * Retrieve a Story File by ID.
   * @param {string} id
   */
  get(id) {
    const filePath = join(STORY_FILES_DIR, `${id}.json`);
    if (!existsSync(filePath)) throw new Error(`Story File not found: ${id}`);
    return JSON.parse(readFileSync(filePath, 'utf-8'));
  }

  /**
   * List all Story Files, optionally filtered by status.
   * @param {{ status?: string }} options
   */
  list({ status } = {}) {
    if (!existsSync(STORY_FILES_DIR)) return [];

    return readdirSync(STORY_FILES_DIR)
      .filter((f) => f.endsWith('.json'))
      .map((f) => JSON.parse(readFileSync(join(STORY_FILES_DIR, f), 'utf-8')))
      .filter((sf) => !status || sf.status === status)
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }

  /**
   * Update a Story File's status.
   * @param {string} id
   * @param {'in-progress'|'done'|'blocked'} status
   * @param {string} [note]
   */
  updateStatus(id, status, note) {
    const storyFile = this.get(id);
    storyFile.status = status;
    storyFile.updatedAt = new Date().toISOString();
    if (note) storyFile.statusNote = note;

    const filePath = join(STORY_FILES_DIR, `${id}.json`);
    writeFileSync(filePath, JSON.stringify(storyFile, null, 2));
    return storyFile;
  }

  /**
   * Convert a Story File to a formatted markdown string for AI context injection.
   * @param {string} id
   */
  toMarkdown(id) {
    const sf = this.get(id);

    return `# Story File: ${sf.id}
**Title:** ${sf.title}
**Status:** ${sf.status}
**Sprint:** ${sf.sprint || 'Unassigned'}
**Story Points:** ${sf.storyPoints || '?'}
**Priority:** ${sf.priority}

## User Story
${sf.userStory}

## Acceptance Criteria
${sf.acceptanceCriteria.map((ac, i) => `- [ ] ${ac}`).join('\n')}

## Technical Context
${sf.technicalContext}

## UX Specifications
${sf.uxSpecs || '_No UX specs provided._'}

## Test Requirements
${sf.testRequirements ? sf.testRequirements.map((t) => `- ${t}`).join('\n') : '_To be defined by @qa._'}

## Definition of Done
${sf.definitionOfDone.map((item) => `- [ ] ${item}`).join('\n')}

## Dependencies
${sf.dependencies?.length ? sf.dependencies.map((d) => `- ${d}`).join('\n') : '_None_'}

## Notes
${sf.notes || '_None_'}

---
_Created by @sm on ${sf.createdAt}_`;
  }

  _validate(data) {
    const required = ['title', 'userStory', 'acceptanceCriteria', 'technicalContext', 'priority'];
    for (const field of required) {
      if (!data[field]) throw new Error(`Story File missing required field: ${field}`);
    }

    return {
      title: data.title,
      userStory: data.userStory,
      acceptanceCriteria: Array.isArray(data.acceptanceCriteria)
        ? data.acceptanceCriteria
        : [data.acceptanceCriteria],
      technicalContext: data.technicalContext,
      uxSpecs: data.uxSpecs || null,
      testRequirements: data.testRequirements || [],
      priority: data.priority, // Critical | High | Medium | Low
      storyPoints: data.storyPoints || null,
      sprint: data.sprint || null,
      dependencies: data.dependencies || [],
      definitionOfDone: data.definitionOfDone || [
        'Code implemented and peer-reviewed',
        'Unit tests written and passing',
        'All acceptance criteria verified',
        'QA sign-off received',
        'No critical linting errors',
        'Deployed to staging environment',
      ],
      notes: data.notes || null,
      assignedTo: data.assignedTo || '@dev',
    };
  }

  _generateId() {
    const ts = Date.now().toString(36).toUpperCase();
    const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
    return `SF-${ts}-${rand}`;
  }
}

/**
 * @typedef {Object} StoryFileSchema
 * @property {string} title - Short, actionable title
 * @property {string} userStory - Full "As a... I want... So that..." statement
 * @property {string[]} acceptanceCriteria - Testable Given/When/Then criteria
 * @property {string} technicalContext - Architecture notes, API endpoints, data models
 * @property {string} [uxSpecs] - Component specs and interaction notes from @ux-expert
 * @property {string[]} [testRequirements] - Test cases from @qa
 * @property {'Critical'|'High'|'Medium'|'Low'} priority
 * @property {number} [storyPoints]
 * @property {string} [sprint]
 * @property {string[]} [dependencies]
 * @property {string[]} [definitionOfDone]
 * @property {string} [notes]
 */
