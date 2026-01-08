import jwt from '@fastify/jwt';
import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';

export async function registerJwt(fastify: FastifyInstance): Promise<void> {
    await fastify.register(jwt, {
        secret: process.env.JWT_SECRET || 'your-secret-key',
        sign: {
            expiresIn: process.env.JWT_EXPIRES_IN || '7d'
        }
    });
}

export async function authenticate(
    request: FastifyRequest,
    reply: FastifyReply
): Promise<void> {
    try {
        await request.jwtVerify();
    } catch (err) {
        reply.code(401).send({ error: 'Unauthorized' });
    }
}

export interface JwtPayload {
    id: number;
    email: string;
    username: string;
}
