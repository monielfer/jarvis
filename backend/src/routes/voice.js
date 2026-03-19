import { Router } from 'express';
import multer from 'multer';
import { transcribeAudio, synthesizeSpeech } from '../services/voiceService.js';
import { streamMessage } from '../services/aiService.js';

const router = Router();

// multer — store audio in memory (no disk writes)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB max
  fileFilter: (_req, file, cb) => {
    const allowed = ['audio/webm', 'audio/mp4', 'audio/wav', 'audio/ogg', 'audio/mpeg'];
    cb(null, allowed.includes(file.mimetype) || file.originalname.endsWith('.webm'));
  },
});

// ─── POST /api/voice/stt ─────────────────────────────────────────────────────
// Receives audio file → returns transcript via Whisper-1
router.post('/stt', upload.single('audio'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No audio file provided (field: "audio")' });
    }

    const { language = 'pt' } = req.body;
    const result = await transcribeAudio(req.file.buffer, {
      mimeType: req.file.mimetype,
      language,
    });

    res.json(result);
  } catch (error) {
    console.error('[Voice/STT]', error.message);
    res.status(500).json({ error: error.message });
  }
});

// ─── POST /api/voice/tts ─────────────────────────────────────────────────────
// Receives text → returns mp3 audio stream (TTS-1, voice: onyx)
router.post('/tts', async (req, res) => {
  try {
    const { text, voice = 'onyx', speed = 1.0 } = req.body;

    if (!text?.trim()) {
      return res.status(400).json({ error: '"text" is required' });
    }

    const audioBuffer = await synthesizeSpeech(text, { voice, speed });

    res.set({
      'Content-Type': 'audio/mpeg',
      'Content-Length': audioBuffer.length,
      'Cache-Control': 'no-cache',
    });
    res.send(audioBuffer);
  } catch (error) {
    console.error('[Voice/TTS]', error.message);
    res.status(500).json({ error: error.message });
  }
});

// ─── POST /api/voice/chat ────────────────────────────────────────────────────
// Full round-trip: audio → Whisper → Claude (streaming) → TTS paralelo → mp3
// TTS começa a ser gerado frase a frase enquanto o Claude ainda escreve.
router.post('/chat', upload.single('audio'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No audio file provided' });
    }

    const { sessionId, language = 'pt' } = req.body;

    // ── 1. Transcrição (Whisper-1) ─────────────────────────────────────────
    const { text: userText } = await transcribeAudio(req.file.buffer, {
      mimeType: req.file.mimetype,
      language,
    });

    if (!userText) {
      return res.status(422).json({ error: 'Could not transcribe audio — please try again' });
    }

    // ── 2. Claude streaming + TTS paralelo por frase ───────────────────────
    // Detecta fim de frase e dispara TTS imediatamente, sem esperar o texto completo.
    let sentenceBuffer = '';          // texto acumulado aguardando ponto final
    const ttsJobs      = [];          // Promise<Buffer>[] em ordem de chegada
    const SENTENCE_RE  = /[.!?。]\s+/; // delimita frase completa

    function flushSentence(text) {
      if (!text.trim()) return;
      // Dispara TTS sem await — paralelismo real com a geração do restante
      ttsJobs.push(synthesizeSpeech(text.trim(), { voice: 'onyx' }));
    }

    const { reply: fullReply, sessionId: sid } = await streamMessage(
      { message: userText, sessionId },
      (chunk) => {
        sentenceBuffer += chunk;
        // Verifica se há frases completas para despachar ao TTS agora
        let match;
        while ((match = SENTENCE_RE.exec(sentenceBuffer)) !== null) {
          const sentence = sentenceBuffer.slice(0, match.index + match[0].length);
          sentenceBuffer  = sentenceBuffer.slice(match.index + match[0].length);
          flushSentence(sentence);
        }
      }
    );

    // Flush de qualquer texto restante após o stream fechar
    flushSentence(sentenceBuffer);

    // ── 3. Aguarda todos os buffers TTS (já estão sendo gerados em paralelo) ─
    const audioChunks  = await Promise.all(ttsJobs);
    const audioBuffer  = Buffer.concat(audioChunks);

    res.set({
      'Content-Type':     'audio/mpeg',
      'Content-Length':   audioBuffer.length,
      'X-User-Transcript': encodeURIComponent(userText),
      'X-Jarvis-Reply':    encodeURIComponent(fullReply),
      'X-Session-Id':      sid || '',
    });
    res.send(audioBuffer);

  } catch (error) {
    console.error('[Voice/Chat]', error.message);
    res.status(500).json({ error: error.message });
  }
});

export default router;
