import { FastifyPluginAsync } from 'fastify';
import prisma from '../lib/prisma.js';
import { authenticate, JwtPayload } from '../lib/jwt.js';
import { publishEvent } from '../lib/redis.js';

const friendRoutes: FastifyPluginAsync = async (fastify) => {
    // Get friends list
    fastify.get('/', { preHandler: [authenticate] }, async (request, reply) => {
        const user = request.user as JwtPayload;

        const friends = await prisma.friend.findMany({
            where: {
                OR: [
                    { userId: user.id, status: 'accepted' },
                    { friendId: user.id, status: 'accepted' }
                ]
            },
            include: {
                user: { select: { id: true, username: true, displayName: true, avatarUrl: true, isOnline: true } },
                friend: { select: { id: true, username: true, displayName: true, avatarUrl: true, isOnline: true } }
            }
        });

        const friendList = friends.map(f => {
            const friendUser = f.userId === user.id ? f.friend : f.user;
            return {
                id: friendUser.id,
                username: friendUser.username,
                display_name: friendUser.displayName,
                avatar_url: friendUser.avatarUrl,
                is_online: friendUser.isOnline
            };
        });

        return reply.send({ friends: friendList });
    });

    // Get pending requests
    fastify.get('/pending', { preHandler: [authenticate] }, async (request, reply) => {
        const user = request.user as JwtPayload;

        const pending = await prisma.friend.findMany({
            where: { friendId: user.id, status: 'pending' },
            include: {
                user: { select: { id: true, username: true, displayName: true, avatarUrl: true } }
            }
        });

        return reply.send({
            requests: pending.map(p => ({
                id: p.id,
                from: {
                    id: p.user.id,
                    username: p.user.username,
                    display_name: p.user.displayName,
                    avatar_url: p.user.avatarUrl
                },
                created_at: p.createdAt
            }))
        });
    });

    // Send friend request
    fastify.post('/:friendId', { preHandler: [authenticate] }, async (request, reply) => {
        const user = request.user as JwtPayload;
        const { friendId } = request.params as { friendId: string };
        const targetId = parseInt(friendId);

        if (user.id === targetId) {
            return reply.code(400).send({ error: 'Cannot add yourself' });
        }

        const existing = await prisma.friend.findFirst({
            where: {
                OR: [
                    { userId: user.id, friendId: targetId },
                    { userId: targetId, friendId: user.id }
                ]
            }
        });

        if (existing) {
            return reply.code(409).send({ error: 'Friend request already exists' });
        }

        const friend = await prisma.friend.create({
            data: { userId: user.id, friendId: targetId, status: 'pending' }
        });

        await publishEvent('friend:request', { from: user.id, to: targetId });

        return reply.code(201).send({ message: 'Friend request sent', id: friend.id });
    });

    // Accept/Reject friend request
    fastify.put('/:requestId', { preHandler: [authenticate] }, async (request, reply) => {
        const user = request.user as JwtPayload;
        const { requestId } = request.params as { requestId: string };
        const { action } = request.body as { action: 'accept' | 'reject' };

        const friendRequest = await prisma.friend.findUnique({
            where: { id: parseInt(requestId) }
        });

        if (!friendRequest || friendRequest.friendId !== user.id) {
            return reply.code(404).send({ error: 'Request not found' });
        }

        if (action === 'accept') {
            await prisma.friend.update({
                where: { id: friendRequest.id },
                data: { status: 'accepted' }
            });
            await publishEvent('friend:accepted', { from: friendRequest.userId, to: user.id });
            return reply.send({ message: 'Friend request accepted' });
        } else {
            await prisma.friend.delete({ where: { id: friendRequest.id } });
            return reply.send({ message: 'Friend request rejected' });
        }
    });

    // Remove friend
    fastify.delete('/:friendId', { preHandler: [authenticate] }, async (request, reply) => {
        const user = request.user as JwtPayload;
        const { friendId } = request.params as { friendId: string };
        const targetId = parseInt(friendId);

        await prisma.friend.deleteMany({
            where: {
                OR: [
                    { userId: user.id, friendId: targetId },
                    { userId: targetId, friendId: user.id }
                ]
            }
        });

        return reply.send({ message: 'Friend removed' });
    });
};

export default friendRoutes;
