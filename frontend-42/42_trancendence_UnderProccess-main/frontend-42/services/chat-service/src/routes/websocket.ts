import { FastifyPluginAsync } from 'fastify';
import { subscribeToChannel } from '../lib/redis.js';

// Connected clients by user ID
const clients = new Map<number, Set<WebSocket>>();

const wsHandler: FastifyPluginAsync = async (fastify) => {
    // WebSocket endpoint
    fastify.get('/ws', { websocket: true }, async (connection, request) => {
        const token = (request.query as { token?: string }).token;

        if (!token) {
            connection.close(4001, 'No token provided');
            return;
        }

        let userId: number;
        try {
            const decoded = fastify.jwt.verify(token) as { id: number };
            userId = decoded.id;
        } catch {
            connection.close(4002, 'Invalid token');
            return;
        }

        console.log(`WebSocket connected: user ${userId}`);

        // Register client
        if (!clients.has(userId)) {
            clients.set(userId, new Set());
        }
        clients.get(userId)!.add(connection as unknown as WebSocket);

        // Handle messages
        connection.on('message', (data: Buffer) => {
            try {
                const message = JSON.parse(data.toString());
                console.log(`Received from ${userId}:`, message);
            } catch (err) {
                console.error('Invalid message format');
            }
        });

        // Handle disconnect
        connection.on('close', () => {
            console.log(`WebSocket disconnected: user ${userId}`);
            clients.get(userId)?.delete(connection as unknown as WebSocket);
            if (clients.get(userId)?.size === 0) {
                clients.delete(userId);
            }
        });
    });
};

// Subscribe to Redis for chat messages
subscribeToChannel('chat:message', (message) => {
    try {
        const data = JSON.parse(message);
        const targetClients = clients.get(data.to);

        if (targetClients) {
            for (const client of targetClients) {
                client.send(JSON.stringify({
                    type: 'new_message',
                    from: data.from,
                    content: data.content,
                    messageId: data.messageId
                }));
            }
        }
    } catch (err) {
        console.error('Failed to process chat message:', err);
    }
}).catch(console.error);

export default wsHandler;
