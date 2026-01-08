import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import prisma from '../lib/prisma.js';
import { authenticate, JwtPayload } from '../lib/jwt.js';

const updateProfileSchema = z.object({
    display_name: z.string().min(3).max(30).optional(),
    avatar_url: z.string().url().optional(),
    nationality: z.string().max(50).optional(),
    phone: z.string().max(20).optional(),
    gender: z.string().max(10).optional(),
    date_of_birth: z.string().optional()
});

const userRoutes: FastifyPluginAsync = async (fastify) => {
    // Get user by ID
    fastify.get('/:id', { preHandler: [authenticate] }, async (request, reply) => {
        const { id } = request.params as { id: string };
        const userId = parseInt(id);

        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: {
                id: true,
                username: true,
                displayName: true,
                avatarUrl: true,
                nationality: true,
                isOnline: true,
                createdAt: true
            }
        });

        if (!user) {
            return reply.code(404).send({ error: 'User not found' });
        }

        return reply.send({
            id: user.id,
            username: user.username,
            display_name: user.displayName,
            avatar_url: user.avatarUrl,
            nationality: user.nationality,
            is_online: user.isOnline,
            created_at: user.createdAt
        });
    });

    // Update user profile
    fastify.put('/:id', { preHandler: [authenticate] }, async (request, reply) => {
        const { id } = request.params as { id: string };
        const userId = parseInt(id);
        const currentUser = request.user as JwtPayload;

        if (currentUser.id !== userId) {
            return reply.code(403).send({ error: 'Cannot update another user profile' });
        }

        try {
            const body = updateProfileSchema.parse(request.body);

            const user = await prisma.user.update({
                where: { id: userId },
                data: {
                    displayName: body.display_name,
                    avatarUrl: body.avatar_url,
                    nationality: body.nationality,
                    phone: body.phone,
                    gender: body.gender,
                    dateOfBirth: body.date_of_birth
                }
            });

            return reply.send({
                id: user.id,
                username: user.username,
                display_name: user.displayName,
                avatar_url: user.avatarUrl,
                nationality: user.nationality
            });
        } catch (error) {
            if (error instanceof z.ZodError) {
                return reply.code(400).send({ error: 'Validation failed', details: error.errors });
            }
            console.error('Update profile error:', error);
            return reply.code(500).send({ error: 'Internal server error' });
        }
    });

    // Get user stats
    fastify.get('/:id/stats', { preHandler: [authenticate] }, async (request, reply) => {
        const { id } = request.params as { id: string };
        const userId = parseInt(id);

        const [wins, losses, total] = await Promise.all([
            prisma.game.count({ where: { winnerId: userId } }),
            prisma.game.count({
                where: {
                    OR: [{ player1Id: userId }, { player2Id: userId }],
                    NOT: { winnerId: userId },
                    winnerId: { not: null }
                }
            }),
            prisma.game.count({
                where: { OR: [{ player1Id: userId }, { player2Id: userId }] }
            })
        ]);

        return reply.send({
            user_id: userId,
            wins,
            losses,
            total_games: total,
            win_rate: total > 0 ? ((wins / total) * 100).toFixed(1) : '0'
        });
    });

    // Search users
    fastify.get('/search', { preHandler: [authenticate] }, async (request, reply) => {
        const { q } = request.query as { q?: string };

        if (!q || q.length < 2) {
            return reply.send({ users: [] });
        }

        const users = await prisma.user.findMany({
            where: {
                OR: [
                    { username: { contains: q } },
                    { displayName: { contains: q } }
                ]
            },
            select: {
                id: true,
                username: true,
                displayName: true,
                avatarUrl: true,
                isOnline: true
            },
            take: 20
        });

        return reply.send({
            users: users.map(u => ({
                id: u.id,
                username: u.username,
                display_name: u.displayName,
                avatar_url: u.avatarUrl,
                is_online: u.isOnline
            }))
        });
    });
};

export default userRoutes;
