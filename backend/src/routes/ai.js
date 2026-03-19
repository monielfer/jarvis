import { Router } from 'express';
import { processMessage } from '../services/aiService.js';

const router = Router();

// POST /api/ai/chat — main chat endpoint
router.post('/chat', async (req, res) => {
  try {
    const { message, sessionId, context } = req.body;

    if (!message) {
      return res.status(400).json({ error: 'Message is required' });
    }

    const response = await processMessage({ message, sessionId, context });
    res.json(response);
  } catch (error) {
    console.error('[AI Route] Error:', error.message);
    res.status(500).json({ error: 'AI processing failed' });
  }
});

export default router;
