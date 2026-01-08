import Fastify from 'fastify';
import cors from '@fastify/cors';
import dotenv from 'dotenv';

import { registerJwt } from './lib/jwt.js';
import prisma from './lib/prisma.js';
import userRoutes from './routes/users.js';
import friendRoutes from './routes/friends.js';

dotenv.config();

const SERVICE_NAME = 'user-service';
const PORT = parseInt(process.env.PORT || '3002');

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
        await prisma.$connect();
        console.log('✅ Database connected');

        await fastify.register(cors, {
            origin: process.env.FRONTEND_URL || 'https://localhost:8443',
            credentials: true
        });
        await registerJwt(fastify);

        await fastify.register(userRoutes, { prefix: '/api/users' });
        await fastify.register(friendRoutes, { prefix: '/api/users/friends' });

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

process.on('SIGINT', async () => {
    await prisma.$disconnect();
    await fastify.close();
    process.exit(0);
});

start();
