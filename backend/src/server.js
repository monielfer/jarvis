import express from 'express';
import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { config } from 'dotenv';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
// Local: lê config/.env | Produção (Render): vars já injetadas, silent ignore
config({ path: resolve(__dirname, '../../config/.env'), silent: true });

import apiRoutes from './routes/api.js';
import aiRoutes from './routes/ai.js';
import agentRoutes from './routes/agents.js';
import voiceRoutes from './routes/voice.js';
import memoryRoutes from './routes/memory.js';
import { initSocketService } from './services/socketService.js';

const app = express();
const httpServer = createServer(app);

// Socket.IO — real-time communication
const io = new SocketIOServer(httpServer, {
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:5173',
    methods: ['GET', 'POST'],
  },
});

// Middleware
app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors({ origin: process.env.FRONTEND_URL || 'http://localhost:5173' }));
app.use(express.json());
app.use(morgan('dev'));

// Routes
app.use('/api', apiRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/agents', agentRoutes);
app.use('/api/voice', voiceRoutes);
app.use('/api/memory', memoryRoutes);

app.get('/health', (_req, res) => {
  res.json({ status: 'JARVIS ONLINE', timestamp: new Date().toISOString() });
});

// Socket events
initSocketService(io);

const PORT = process.env.PORT || 3001;
httpServer.listen(PORT, () => {
  console.log(`🤖 JARVIS Backend running on http://localhost:${PORT}`);
});

export { io };
