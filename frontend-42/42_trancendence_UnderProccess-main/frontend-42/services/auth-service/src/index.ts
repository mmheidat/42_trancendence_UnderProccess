import Fastify from 'fastify';
import cors from '@fastify/cors';
import cookie from '@fastify/cookie';
import dotenv from 'dotenv';

import { registerJwt } from './lib/jwt.js';
import prisma from './lib/prisma.js';
import authRoutes from './routes/auth.js';

dotenv.config();

const SERVICE_NAME = 'auth-service';
const PORT = parseInt(process.env.PORT || '3001');

console.log(`🚀 Starting ${SERVICE_NAME}...`);

const fastify = Fastify({
    logger: {
        level: 'info',
        transport: {
            target: 'pino-pretty',
            options: { colorize: true, translateTime: 'HH:MM:ss Z', ignore: 'pid,hostname' }
        }
    }
});

async function start(): Promise<void> {
    try {
        // Connect to database
        await prisma.$connect();
        console.log('✅ Database connected');

        // Register plugins
        await fastify.register(cors, {
            origin: process.env.FRONTEND_URL || 'https://localhost:8443',
            credentials: true
        });
        await fastify.register(cookie);
        await registerJwt(fastify);

        // Register routes
        await fastify.register(authRoutes, { prefix: '/api/auth' });

        // Health check
        fastify.get('/health', async () => ({
            service: SERVICE_NAME,
            status: 'ok',
            timestamp: new Date().toISOString()
        }));

        await fastify.listen({ port: PORT, host: '0.0.0.0' });
        console.log(`✅ ${SERVICE_NAME} running on port ${PORT}`);
    } catch (err) {
        console.error('❌ Failed to start:', err);
        process.exit(1);
    }
}

// Graceful shutdown
process.on('SIGINT', async () => {
    await prisma.$disconnect();
    await fastify.close();
    process.exit(0);
});

start();
