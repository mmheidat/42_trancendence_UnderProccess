import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import bcrypt from 'bcrypt';
import oauthPlugin from '@fastify/oauth2';
import axios from 'axios';
import prisma from '../lib/prisma.js';
import { authenticate, JwtPayload } from '../lib/jwt.js';
import { publishEvent } from '../lib/redis.js';

const registerSchema = z.object({
    username: z.string().min(3).max(20),
    email: z.string().email(),
    password: z.string().min(8),
    display_name: z.string().min(3).max(30).optional()
});

const loginSchema = z.object({
    email: z.string().email(),
    password: z.string()
});

const googleOAuthConfig = {
    name: 'googleOAuth2',
    credentials: {
        client: {
            id: process.env.GOOGLE_CLIENT_ID!,
            secret: process.env.GOOGLE_CLIENT_SECRET!
        },
        auth: {
            authorizeHost: 'https://accounts.google.com',
            authorizePath: '/o/oauth2/v2/auth',
            tokenHost: 'https://oauth2.googleapis.com',
            tokenPath: '/token'
        }
    },
    startRedirectPath: '/api/auth/google',
    callbackUri: process.env.GOOGLE_REDIRECT_URI || 'https://localhost:8443/api/auth/google/callback',
    scope: ['email', 'profile']
};

interface GoogleUserInfo {
    id: string;
    email: string;
    verified_email: boolean;
    name: string;
    picture: string;
}

const authRoutes: FastifyPluginAsync = async (fastify) => {
    // Register OAuth plugin
    if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
        await fastify.register(oauthPlugin, googleOAuthConfig);
        console.log('✅ OAuth plugin registered');
    }

    // Register
    fastify.post('/register', async (request, reply) => {
        try {
            const body = registerSchema.parse(request.body);

            const existing = await prisma.user.findFirst({
                where: { OR: [{ email: body.email }, { username: body.username }] }
            });

            if (existing) {
                return reply.code(409).send({ error: 'User already exists' });
            }

            const hashedPassword = await bcrypt.hash(body.password, 10);
            const user = await prisma.user.create({
                data: {
                    username: body.username,
                    email: body.email,
                    passwordHash: hashedPassword,
                    displayName: body.display_name || body.username,
                }
            });

            const token = fastify.jwt.sign({ id: user.id, email: user.email, username: user.username });

            // Publish event
            await publishEvent('user:created', { userId: user.id, username: user.username });

            return reply.code(201).send({
                message: 'User registered successfully',
                token,
                user: {
                    id: user.id,
                    username: user.username,
                    email: user.email,
                    display_name: user.displayName,
                    avatar_url: user.avatarUrl
                }
            });
        } catch (error) {
            if (error instanceof z.ZodError) {
                return reply.code(400).send({ error: 'Validation failed', details: error.errors });
            }
            console.error('Register error:', error);
            return reply.code(500).send({ error: 'Internal server error' });
        }
    });

    // Login
    fastify.post('/login', async (request, reply) => {
        try {
            const body = loginSchema.parse(request.body);

            const user = await prisma.user.findUnique({ where: { email: body.email } });
            if (!user) {
                return reply.code(401).send({ error: 'Invalid credentials' });
            }

            if (user.oauthProvider && !user.passwordHash) {
                return reply.code(400).send({ error: `Please sign in with ${user.oauthProvider}` });
            }

            const valid = await bcrypt.compare(body.password, user.passwordHash);
            if (!valid) {
                return reply.code(401).send({ error: 'Invalid credentials' });
            }

            await prisma.user.update({
                where: { id: user.id },
                data: { isOnline: true, lastSeen: new Date() }
            });

            const token = fastify.jwt.sign({ id: user.id, email: user.email, username: user.username });

            await publishEvent('user:login', { userId: user.id });

            return reply.send({
                message: 'Login successful',
                token,
                user: {
                    id: user.id,
                    username: user.username,
                    email: user.email,
                    display_name: user.displayName,
                    avatar_url: user.avatarUrl,
                    is_online: user.isOnline
                }
            });
        } catch (error) {
            if (error instanceof z.ZodError) {
                return reply.code(400).send({ error: 'Validation failed' });
            }
            console.error('Login error:', error);
            return reply.code(500).send({ error: 'Internal server error' });
        }
    });

    // Google OAuth start
    fastify.get('/google', async (request, reply) => {
        try {
            const authUrl = await fastify.googleOAuth2.generateAuthorizationUri(request, reply);
            return reply.redirect(authUrl);
        } catch (error) {
            console.error('OAuth init error:', error);
            return reply.code(500).send({ error: 'Failed to initiate OAuth' });
        }
    });

    // Google OAuth callback
    fastify.get('/google/callback', async (request, reply) => {
        try {
            const result = await fastify.googleOAuth2.getAccessTokenFromAuthorizationCodeFlow(request);

            if (!result?.token?.access_token) {
                const frontendUrl = process.env.FRONTEND_URL || 'https://localhost:8443';
                return reply.redirect(`${frontendUrl}?message=Failed to get access token`);
            }

            const { data: googleUser } = await axios.get<GoogleUserInfo>(
                'https://www.googleapis.com/oauth2/v2/userinfo',
                { headers: { Authorization: `Bearer ${result.token.access_token}` } }
            );

            if (!googleUser.verified_email) {
                const frontendUrl = process.env.FRONTEND_URL || 'https://localhost:8443';
                return reply.redirect(`${frontendUrl}?message=Email not verified`);
            }

            let user = await prisma.user.findFirst({
                where: { oauthProvider: 'google', oauthId: googleUser.id }
            });

            if (!user) {
                user = await prisma.user.findUnique({ where: { email: googleUser.email } });

                if (user) {
                    await prisma.user.update({
                        where: { id: user.id },
                        data: { oauthProvider: 'google', oauthId: googleUser.id }
                    });
                } else {
                    const username = googleUser.email.split('@')[0] + '_' + Date.now().toString().slice(-4);
                    user = await prisma.user.create({
                        data: {
                            email: googleUser.email,
                            username,
                            displayName: googleUser.name,
                            avatarUrl: googleUser.picture,
                            oauthProvider: 'google',
                            oauthId: googleUser.id,
                            passwordHash: ''
                        }
                    });
                    await publishEvent('user:created', { userId: user.id, username: user.username });
                }
            }

            await prisma.user.update({
                where: { id: user.id },
                data: { isOnline: true, lastSeen: new Date() }
            });

            const token = fastify.jwt.sign({ id: user.id, email: user.email, username: user.username });

            const frontendUrl = process.env.FRONTEND_URL || 'https://localhost:8443';
            return reply.redirect(`${frontendUrl}?token=${token}`);

        } catch (error) {
            console.error('OAuth callback error:', error);
            const frontendUrl = process.env.FRONTEND_URL || 'https://localhost:8443';
            return reply.redirect(`${frontendUrl}?message=Authentication failed`);
        }
    });

    // Logout
    fastify.post('/logout', { preHandler: [authenticate] }, async (request, reply) => {
        const user = request.user as JwtPayload;
        await prisma.user.update({
            where: { id: user.id },
            data: { isOnline: false, lastSeen: new Date() }
        });
        await publishEvent('user:logout', { userId: user.id });
        return reply.send({ message: 'Logged out successfully' });
    });

    // Get current user
    fastify.get('/me', { preHandler: [authenticate] }, async (request, reply) => {
        const tokenUser = request.user as JwtPayload;
        const user = await prisma.user.findUnique({ where: { id: tokenUser.id } });

        if (!user) {
            return reply.code(404).send({ error: 'User not found' });
        }

        return reply.send({
            id: user.id,
            username: user.username,
            email: user.email,
            display_name: user.displayName,
            avatar_url: user.avatarUrl,
            nationality: user.nationality,
            is_online: user.isOnline,
            oauth_provider: user.oauthProvider,
            created_at: user.createdAt
        });
    });

    // Verify token (for internal service use)
    fastify.get('/verify', { preHandler: [authenticate] }, async (request, reply) => {
        return reply.send({ valid: true, user: request.user });
    });
};

export default authRoutes;
