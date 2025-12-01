import Fastify from 'fastify';
import cors from '@fastify/cors';
import jwt from '@fastify/jwt';
import websocket from '@fastify/websocket';
import cookie from '@fastify/cookie';
import dotenv from 'dotenv';

import initDatabase from './utils/initDb.js';
import authRoutes from './routes/auth.js';

dotenv.config();

console.log('🚀 Starting Pong Backend Server...');
console.log('📝 Environment:', process.env.NODE_ENV);
console.log('🌐 Frontend URL:', process.env.FRONTEND_URL);
console.log('🔑 Google Client ID:', process.env.GOOGLE_CLIENT_ID);
console.log('🔒 Has Google Secret:', !!process.env.GOOGLE_CLIENT_SECRET);
console.log('🔗 Redirect URI:', process.env.GOOGLE_REDIRECT_URI);

const fastify = Fastify({
    logger: {
        level: 'info',
        transport: {
            target: 'pino-pretty',
            options: {
                colorize: true,
                translateTime: 'HH:MM:ss Z',
                ignore: 'pid,hostname'
            }
        }
    }
});

// Initialize database
initDatabase();

// Register plugins
console.log('🔌 Registering plugins...');

await fastify.register(cors, {
    origin: process.env.FRONTEND_URL || 'http://localhost:8080',
    credentials: true
});
console.log('✅ CORS registered');

await fastify.register(jwt, {
    secret: process.env.JWT_SECRET || 'your-secret-key',
    sign: {
        expiresIn: process.env.JWT_EXPIRES_IN || '7d'
    }
});
console.log('✅ JWT registered');

await fastify.register(cookie);
console.log('✅ Cookie registered');

await fastify.register(websocket);
console.log('✅ WebSocket registered');

// Register routes - OAuth plugin is registered inside authRoutes
console.log('🛣️  Registering auth routes...');
await fastify.register(authRoutes, { prefix: '/api/auth' });
console.log('✅ Auth routes registered');

// Health check
fastify.get('/health', async () => {
    return { status: 'ok', timestamp: new Date().toISOString() };
});

// Start server
const start = async () => {
    try {
        const port = parseInt(process.env.PORT || '3000');
        await fastify.listen({ port, host: '0.0.0.0' });
        console.log('🚀 Server running at http://localhost:' + port);
        console.log('🔗 OAuth redirect URI: ' + process.env.GOOGLE_REDIRECT_URI);
        console.log('✅ Backend ready!');
    } catch (err) {
        fastify.log.error(err);
        process.exit(1);
    }
};

start();