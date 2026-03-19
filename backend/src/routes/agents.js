import { Router } from 'express';
import { AgentRunner } from '../../../agents/orchestrator/agentRunner.js';
import { StoryFileManager } from '../../../agents/storyFiles/StoryFileManager.js';

const router = Router();
const runner = new AgentRunner();
const storyFiles = new StoryFileManager();

// GET /api/agents — list all registered agents and their status
router.get('/', (_req, res) => {
  res.json({ agents: runner.getStatus() });
});

// POST /api/agents/run — run a task through the agent system
// Body: { task, agentName?, context?, storyData? }
router.post('/run', async (req, res) => {
  try {
    const { task, agentName, context, storyData } = req.body;

    if (!task) {
      return res.status(400).json({ error: 'task is required' });
    }

    const result = await runner.run({ task, agentName, context, storyData });
    res.json(result);
  } catch (error) {
    console.error('[Agents Route] Error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// GET /api/agents/story-files — list all story files
router.get('/story-files', (req, res) => {
  const { status } = req.query;
  res.json({ storyFiles: storyFiles.list({ status }) });
});

// GET /api/agents/story-files/:id — get a specific story file
router.get('/story-files/:id', (req, res) => {
  try {
    const sf = storyFiles.get(req.params.id);
    res.json(sf);
  } catch (error) {
    res.status(404).json({ error: error.message });
  }
});

// GET /api/agents/story-files/:id/markdown — get story file as markdown (for @dev)
router.get('/story-files/:id/markdown', (req, res) => {
  try {
    const md = storyFiles.toMarkdown(req.params.id);
    res.type('text/markdown').send(md);
  } catch (error) {
    res.status(404).json({ error: error.message });
  }
});

// PATCH /api/agents/story-files/:id/status — update story file status
router.patch('/story-files/:id/status', (req, res) => {
  try {
    const { status, note } = req.body;
    const updated = storyFiles.updateStatus(req.params.id, status, note);
    res.json(updated);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// POST /api/agents/story-files — create a story file manually
router.post('/story-files', async (req, res) => {
  try {
    const sf = await storyFiles.create(req.body);
    res.status(201).json(sf);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

export default router;
