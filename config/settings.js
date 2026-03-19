import 'dotenv/config';

export const settings = {
  server: {
    port: parseInt(process.env.PORT) || 3001,
    env: process.env.NODE_ENV || 'development',
    frontendUrl: process.env.FRONTEND_URL || 'http://localhost:5173',
  },
  ai: {
    anthropicKey: process.env.ANTHROPIC_API_KEY,
    openaiKey: process.env.OPENAI_API_KEY,
    defaultModel: 'claude-sonnet-4-6',
    maxTokens: 1024,
  },
  supabase: {
    url: process.env.SUPABASE_URL,
    anonKey: process.env.SUPABASE_ANON_KEY,
  },
  features: {
    voice: process.env.ENABLE_VOICE === 'true',
    browserAgent: process.env.ENABLE_BROWSER_AGENT === 'true',
    debugAgents: process.env.DEBUG_AGENTS === 'true',
  },
};
