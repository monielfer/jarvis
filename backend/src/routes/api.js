import { Router } from 'express';

const router = Router();

router.get('/status', (_req, res) => {
  res.json({ jarvis: 'operational', version: '1.0.0' });
});

router.get('/agents', (_req, res) => {
  // TODO: return registered agents from registry
  res.json({ agents: [] });
});

export default router;
