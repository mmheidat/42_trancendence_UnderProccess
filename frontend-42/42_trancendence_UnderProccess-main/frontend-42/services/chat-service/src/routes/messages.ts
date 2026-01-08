import { FastifyPluginAsync } from 'fastify';
import prisma from '../lib/prisma.js';
import { authenticate, JwtPayload } from '../lib/jwt.js';
import { publishEvent } from '../lib/redis.js';

const chatRoutes: FastifyPluginAsync = async (fastify) => {
    // Get conversations
    fastify.get('/conversations', { preHandler: [authenticate] }, async (request, reply) => {
        const user = request.user as JwtPayload;

        const messages = await prisma.message.findMany({
            where: {
                OR: [{ senderId: user.id }, { receiverId: user.id }]
            },
            include: {
                sender: { select: { id: true, username: true, displayName: true, avatarUrl: true } },
                receiver: { select: { id: true, username: true, displayName: true, avatarUrl: true } }
            },
            orderBy: { sentAt: 'desc' }
        });

        // Group by conversation partner
        const conversationsMap = new Map<number, any>();

        for (const msg of messages) {
            const partnerId = msg.senderId === user.id ? msg.receiverId : msg.senderId;
            const partner = msg.senderId === user.id ? msg.receiver : msg.sender;

            if (!conversationsMap.has(partnerId)) {
                conversationsMap.set(partnerId, {
                    user: {
                        id: partner.id,
                        username: partner.username,
                        display_name: partner.displayName,
                        avatar_url: partner.avatarUrl
                    },
                    last_message: {
                        content: msg.content,
                        sent_at: msg.sentAt,
                        is_mine: msg.senderId === user.id
                    },
                    unread_count: 0
                });
            }

            if (msg.receiverId === user.id && !msg.read) {
                conversationsMap.get(partnerId).unread_count++;
            }
        }

        return reply.send({ conversations: Array.from(conversationsMap.values()) });
    });

    // Get messages with user
    fastify.get('/messages/:userId', { preHandler: [authenticate] }, async (request, reply) => {
        const user = request.user as JwtPayload;
        const { userId } = request.params as { userId: string };
        const targetId = parseInt(userId);
        const { limit = 50 } = request.query as { limit?: number };

        const messages = await prisma.message.findMany({
            where: {
                OR: [
                    { senderId: user.id, receiverId: targetId },
                    { senderId: targetId, receiverId: user.id }
                ]
            },
            orderBy: { sentAt: 'asc' },
            take: Number(limit)
        });

        // Mark as read
        await prisma.message.updateMany({
            where: { senderId: targetId, receiverId: user.id, read: false },
            data: { read: true }
        });

        return reply.send({
            messages: messages.map(m => ({
                id: m.id,
                sender_id: m.senderId,
                receiver_id: m.receiverId,
                content: m.content,
                read: m.read,
                sent_at: m.sentAt,
                is_mine: m.senderId === user.id
            }))
        });
    });

    // Send message
    fastify.post('/messages/:userId', { preHandler: [authenticate] }, async (request, reply) => {
        const user = request.user as JwtPayload;
        const { userId } = request.params as { userId: string };
        const { content } = request.body as { content: string };
        const targetId = parseInt(userId);

        if (!content || content.trim().length === 0) {
            return reply.code(400).send({ error: 'Message cannot be empty' });
        }

        const message = await prisma.message.create({
            data: {
                senderId: user.id,
                receiverId: targetId,
                content: content.trim()
            }
        });

        await publishEvent('chat:message', {
            messageId: message.id,
            from: user.id,
            to: targetId,
            content: message.content
        });

        return reply.code(201).send({
            id: message.id,
            sender_id: message.senderId,
            receiver_id: message.receiverId,
            content: message.content,
            sent_at: message.sentAt
        });
    });
};

export default chatRoutes;
