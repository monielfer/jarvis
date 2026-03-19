import OpenAI from 'openai';
import { Readable } from 'stream';

// Lazy — instantiated on first call so env vars are already loaded
let _openai = null;
const getOpenAI = () => {
  if (!_openai) _openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  return _openai;
};

/**
 * STT — Speech to Text via Whisper-1.
 * Accepts an audio Buffer (webm/mp4/wav/ogg) and returns the transcript.
 * @param {Buffer} audioBuffer
 * @param {{ mimeType?: string, language?: string }} options
 * @returns {Promise<{ text: string, duration?: number }>}
 */
export async function transcribeAudio(audioBuffer, { mimeType = 'audio/webm', language = 'pt' } = {}) {
  // OpenAI SDK requires a File-like object with a name
  const file = new File([audioBuffer], 'recording.webm', { type: mimeType });

  const response = await getOpenAI().audio.transcriptions.create({
    model: 'whisper-1',
    file,
    language,          // 'pt' for Portuguese, null for auto-detect
    response_format: 'verbose_json',
  });

  return {
    text: response.text?.trim() || '',
    duration: response.duration,
    language: response.language,
  };
}

/**
 * TTS — Text to Speech via TTS-1 with Onyx voice.
 * Returns an audio Buffer (mp3).
 * @param {string} text
 * @param {{ voice?: string, speed?: number }} options
 * @returns {Promise<Buffer>}
 */
export async function synthesizeSpeech(text, { voice = 'onyx', speed = 1.0 } = {}) {
  if (!text?.trim()) throw new Error('TTS: text cannot be empty');

  const response = await getOpenAI().audio.speech.create({
    model: 'tts-1',
    voice,      // onyx — deep, authoritative (JARVIS-appropriate)
    input: text,
    speed,
    response_format: 'mp3',
  });

  // Convert response body to Buffer
  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

/**
 * Full voice round-trip: audio → Whisper → Claude (external) → TTS → audio.
 * The AI processing step is handled by the caller (aiService).
 * This service only handles STT and TTS.
 */
export const VoiceService = { transcribeAudio, synthesizeSpeech };
