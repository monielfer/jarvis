import { Router } from 'express';
import {
  getHistoricoRecente,
  getFatosRelevantes,
  getProjetosAtivos,
  getPerfil,
  salvarFato,
  salvarDecisao,
  salvarEntregavel,
} from '../../../memory/memoryService.js';

const router = Router();

// GET /api/memory/status — verifica conexão com Supabase
router.get('/status', async (_req, res) => {
  try {
    const perfil = await getPerfil();
    res.json({ connected: !!perfil, perfil: perfil?.nome || null });
  } catch (e) {
    res.status(500).json({ connected: false, error: e.message });
  }
});

// GET /api/memory/perfil
router.get('/perfil', async (_req, res) => {
  res.json(await getPerfil());
});

// GET /api/memory/fatos
router.get('/fatos', async (_req, res) => {
  res.json(await getFatosRelevantes(20));
});

// POST /api/memory/fatos
router.post('/fatos', async (req, res) => {
  try {
    await salvarFato({ ...req.body, origem: 'manual' });
    res.status(201).json({ ok: true });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

// GET /api/memory/projetos
router.get('/projetos', async (_req, res) => {
  res.json(await getProjetosAtivos());
});

// GET /api/memory/historico/:sessionId
router.get('/historico/:sessionId', async (req, res) => {
  res.json(await getHistoricoRecente(req.params.sessionId, 20));
});

// POST /api/memory/decisoes
router.post('/decisoes', async (req, res) => {
  try {
    await salvarDecisao(req.body);
    res.status(201).json({ ok: true });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

// POST /api/memory/entregaveis
router.post('/entregaveis', async (req, res) => {
  try {
    await salvarEntregavel(req.body);
    res.status(201).json({ ok: true });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

export default router;
