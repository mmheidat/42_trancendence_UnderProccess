import { FastifyPluginAsync } from 'fastify';
import prisma from '../lib/prisma.js';
import { authenticate, JwtPayload } from '../lib/jwt.js';
import { publishEvent } from '../lib/redis.js';

const gameRoutes: FastifyPluginAsync = async (fastify) => {
    // Create a new game
    fastify.post('/', { preHandler: [authenticate] }, async (request, reply) => {
        const user = request.user as JwtPayload;
        const { player2_id, game_mode } = request.body as { player2_id?: number; game_mode: string };

        const game = await prisma.game.create({
            data: {
                player1Id: user.id,
                player2Id: player2_id || null,
                gameMode: game_mode || 'pvp'
            }
        });

        await publishEvent('game:created', { gameId: game.id, player1: user.id, player2: player2_id });

        return reply.code(201).send({
            id: game.id,
            player1_id: game.player1Id,
            player2_id: game.player2Id,
            game_mode: game.gameMode
        });
    });

    // Get game by ID
    fastify.get('/:id', { preHandler: [authenticate] }, async (request, reply) => {
        const { id } = request.params as { id: string };

        const game = await prisma.game.findUnique({
            where: { id: parseInt(id) },
            include: {
                player1: { select: { id: true, username: true, displayName: true } },
                player2: { select: { id: true, username: true, displayName: true } },
                winner: { select: { id: true, username: true, displayName: true } }
            }
        });

        if (!game) {
            return reply.code(404).send({ error: 'Game not found' });
        }

        return reply.send({
            id: game.id,
            player1: game.player1,
            player2: game.player2,
            player1_score: game.player1Score,
            player2_score: game.player2Score,
            winner: game.winner,
            game_mode: game.gameMode,
            played_at: game.playedAt
        });
    });

    // Update game score
    fastify.put('/:id/score', { preHandler: [authenticate] }, async (request, reply) => {
        const { id } = request.params as { id: string };
        const { player1_score, player2_score, winner_id } = request.body as {
            player1_score: number;
            player2_score: number;
            winner_id?: number;
        };

        const game = await prisma.game.update({
            where: { id: parseInt(id) },
            data: {
                player1Score: player1_score,
                player2Score: player2_score,
                winnerId: winner_id
            }
        });

        if (winner_id) {
            await publishEvent('game:ended', { gameId: game.id, winnerId: winner_id });
        }

        return reply.send({ message: 'Score updated', game });
    });

    // Get game history
    fastify.get('/history', { preHandler: [authenticate] }, async (request, reply) => {
        const user = request.user as JwtPayload;
        const { limit = 10 } = request.query as { limit?: number };

        const games = await prisma.game.findMany({
            where: {
                OR: [{ player1Id: user.id }, { player2Id: user.id }]
            },
            include: {
                player1: { select: { id: true, username: true, displayName: true } },
                player2: { select: { id: true, username: true, displayName: true } },
                winner: { select: { id: true, username: true } }
            },
            orderBy: { playedAt: 'desc' },
            take: Number(limit)
        });

        return reply.send({
            games: games.map(g => ({
                id: g.id,
                player1: g.player1,
                player2: g.player2,
                player1_score: g.player1Score,
                player2_score: g.player2Score,
                winner: g.winner,
                game_mode: g.gameMode,
                played_at: g.playedAt
            }))
        });
    });

    // Leaderboard
    fastify.get('/leaderboard', async (request, reply) => {
        const { limit = 10 } = request.query as { limit?: number };

        const users = await prisma.user.findMany({
            include: {
                gamesWon: true,
                gamesAsPlayer1: true,
                gamesAsPlayer2: true
            }
        });

        const leaderboard = users
            .map(user => {
                const totalGames = user.gamesAsPlayer1.length + user.gamesAsPlayer2.length;
                const wins = user.gamesWon.length;
                return {
                    id: user.id,
                    username: user.username,
                    display_name: user.displayName,
                    avatar_url: user.avatarUrl,
                    wins,
                    total_games: totalGames,
                    win_rate: totalGames > 0 ? ((wins / totalGames) * 100).toFixed(1) : '0'
                };
            })
            .filter(u => u.total_games > 0)
            .sort((a, b) => b.wins - a.wins)
            .slice(0, Number(limit));

        return reply.send({ leaderboard });
    });
};

export default gameRoutes;
