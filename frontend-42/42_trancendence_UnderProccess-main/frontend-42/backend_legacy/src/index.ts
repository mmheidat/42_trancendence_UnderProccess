import Fastify from 'fastify';
import cors from '@fastify/cors';
import jwt from '@fastify/jwt';
import websocket from '@fastify/websocket';
import cookie from '@fastify/cookie';
import dotenv from 'dotenv';

import prisma from './lib/prisma.js';
import authRoutes from './routes/auth.js';

dotenv.config();

console.log('🚀 Starting Pong Backend Server...');
console.log('📝 Environment:', process.env.NODE_ENV);
console.log('🌐 Frontend URL:', process.env.FRONTEND_URL);
console.log('🔑 Google Client ID:', process.env.GOOGLE_CLIENT_ID ? 'Set' : 'Not set');
console.log('🔒 Google Secret:', process.env.GOOGLE_CLIENT_SECRET ? 'Set' : 'Not set');

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

// Test database connection
async function testDatabaseConnection(): Promise<void> {
    try {
        await prisma.$connect();
        console.log('✅ Database connected successfully');
    } catch (error) {
        console.error('❌ Database connection failed:', error);
        process.exit(1);
    }
}

// Register plugins
async function registerPlugins(): Promise<void> {
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
}

// Register routes
async function registerRoutes(): Promise<void> {
    console.log('🛣️  Registering routes...');
    await fastify.register(authRoutes, { prefix: '/api/auth' });
    console.log('✅ Auth routes registered');
}

// Health check endpoint
fastify.get('/health', async () => {
    return {
        status: 'ok',
        timestamp: new Date().toISOString(),
        database: 'connected'
    };
});

// Graceful shutdown
async function gracefulShutdown(): Promise<void> {
    console.log('🛑 Shutting down...');
    await prisma.$disconnect();
    await fastify.close();
    process.exit(0);
}

process.on('SIGINT', gracefulShutdown);
process.on('SIGTERM', gracefulShutdown);

// Start server
async function start(): Promise<void> {
    try {
        await testDatabaseConnection();
        await registerPlugins();
        await registerRoutes();

        const port = parseInt(process.env.PORT || '3000');
        await fastify.listen({ port, host: '0.0.0.0' });

        console.log('🚀 Server running at http://localhost:' + port);
        console.log('✅ Backend ready!');
    } catch (err) {
        fastify.log.error(err);
        await prisma.$disconnect();
        process.exit(1);
    }
}

start();