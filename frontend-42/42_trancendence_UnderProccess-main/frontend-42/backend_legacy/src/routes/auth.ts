import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import oauthPlugin from '@fastify/oauth2';
import axios from 'axios';
import { UserModel } from '../models/User.js';
import { authenticate } from '../middleware/auth.js';
import { googleOAuthConfig, GOOGLE_USER_INFO_URL } from '../config/oauth.js';

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

interface GoogleUserInfo {
    id: string;
    email: string;
    verified_email: boolean;
    name: string;
    given_name: string;
    family_name: string;
    picture: string;
    locale: string;
}

const authRoutes: FastifyPluginAsync = async (fastify) => {
    console.log('🔧 Registering OAuth plugin with config:', {
        clientId: googleOAuthConfig.credentials.client.id,
        hasSecret: !!googleOAuthConfig.credentials.client.secret,
        callbackUri: googleOAuthConfig.callbackUri,
        scope: googleOAuthConfig.scope
    });

    // Register Google OAuth plugin
    await fastify.register(oauthPlugin, googleOAuthConfig);
    console.log('✅ OAuth plugin registered successfully');

    // Register endpoint
    fastify.post('/register', async (request, reply) => {
        try {
            console.log('📝 Register request received');
            const body = registerSchema.parse(request.body);

            // Check if user exists
            const existingByEmail = await UserModel.findByEmail(body.email);
            const existingByUsername = await UserModel.findByUsername(body.username);

            if (existingByEmail || existingByUsername) {
                console.log('❌ User already exists:', body.email);
                return reply.code(409).send({ error: 'User already exists' });
            }

            const user = await UserModel.create({
                username: body.username,
                email: body.email,
                password: body.password,
                displayName: body.display_name,
            });
            console.log('✅ User created:', user.id);

            const token = fastify.jwt.sign({
                id: user.id,
                email: user.email,
                username: user.username
            });

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
            console.error('❌ Register error:', error);
            if (error instanceof z.ZodError) {
                return reply.code(400).send({ error: 'Validation failed', details: error.errors });
            }
            return reply.code(500).send({ error: 'Internal server error' });
        }
    });

    // Login endpoint
    fastify.post('/login', async (request, reply) => {
        try {
            console.log('🔐 Login request received');
            const body = loginSchema.parse(request.body);

            const user = await UserModel.findByEmail(body.email);
            if (!user) {
                console.log('❌ User not found:', body.email);
                return reply.code(401).send({ error: 'Invalid credentials' });
            }

            if (user.oauthProvider && !user.passwordHash) {
                console.log('❌ OAuth user trying traditional login:', body.email);
                return reply.code(400).send({ error: `Please sign in with ${user.oauthProvider}` });
            }

            const validPassword = await UserModel.verifyPassword(user, body.password);
            if (!validPassword) {
                console.log('❌ Invalid password for:', body.email);
                return reply.code(401).send({ error: 'Invalid credentials' });
            }

            await UserModel.updateOnlineStatus(user.id, true);
            console.log('✅ User logged in:', user.id);

            const token = fastify.jwt.sign({
                id: user.id,
                email: user.email,
                username: user.username
            });

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
            console.error('❌ Login error:', error);
            if (error instanceof z.ZodError) {
                return reply.code(400).send({ error: 'Validation failed', details: error.errors });
            }
            return reply.code(500).send({ error: 'Internal server error' });
        }
    });

    // Google Sign-in initiation
    fastify.get('/google', async (request, reply) => {
        try {
            console.log('🔵 [STEP 1] Google OAuth initiation started');
            const authUrl = await fastify.googleOAuth2.generateAuthorizationUri(request, reply);
            console.log('🔵 [STEP 2] Generated auth URL');
            return reply.redirect(authUrl);
        } catch (error) {
            console.error('❌ Google OAuth initiation error:', error);
            return reply.code(500).send({ error: 'Failed to initiate Google sign-in' });
        }
    });

    // Google OAuth callback
    fastify.get('/google/callback', async (request, reply) => {
        try {
            console.log('🟢 [STEP 3] Google OAuth callback received');

            const result = await fastify.googleOAuth2.getAccessTokenFromAuthorizationCodeFlow(request);

            if (!result?.token?.access_token) {
                console.error('❌ No access token received');
                const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:8080';
                return reply.redirect(`${frontendUrl}?message=Failed to get access token`);
            }

            console.log('🟢 [STEP 4] Access token received');

            // Fetch user info from Google
            const response = await axios.get<GoogleUserInfo>(GOOGLE_USER_INFO_URL, {
                headers: { Authorization: `Bearer ${result.token.access_token}` }
            });

            const googleUser = response.data;
            console.log('🟢 [STEP 5] Google user info received:', googleUser.email);

            if (!googleUser.verified_email) {
                console.error('❌ Email not verified');
                const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:8080';
                return reply.redirect(`${frontendUrl}?message=Email not verified`);
            }

            // Find or create user
            let user = await UserModel.findByOAuth('google', googleUser.id);

            if (!user) {
                user = await UserModel.findByEmail(googleUser.email);

                if (user) {
                    // Link OAuth to existing account
                    console.log('🟢 [STEP 6] Linking Google to existing user');
                    await UserModel.linkOAuthAccount(user.id, 'google', googleUser.id);
                } else {
                    // Create new user
                    const username = googleUser.email.split('@')[0] + '_' + Date.now().toString().slice(-4);
                    console.log('🟢 [STEP 6] Creating new user');

                    user = await UserModel.createFromOAuth({
                        email: googleUser.email,
                        username,
                        displayName: googleUser.name,
                        avatarUrl: googleUser.picture,
                        oauthProvider: 'google',
                        oauthId: googleUser.id
                    });
                }
            }

            await UserModel.updateOnlineStatus(user.id, true);

            const jwtToken = fastify.jwt.sign({
                id: user.id,
                email: user.email,
                username: user.username
            });

            console.log('🟢 [STEP 7] User authenticated:', user.email);

            const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:8080';
            return reply.redirect(`${frontendUrl}?token=${jwtToken}`);

        } catch (error) {
            console.error('❌ Google OAuth callback error:', error);
            const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:8080';
            return reply.redirect(`${frontendUrl}?message=Authentication failed`);
        }
    });

    // Logout
    fastify.post('/logout', { preHandler: [authenticate] }, async (request, reply) => {
        try {
            const user = request.user as { id: number };
            console.log('👋 User logging out:', user.id);
            await UserModel.updateOnlineStatus(user.id, false);
            return reply.send({ message: 'Logged out successfully' });
        } catch (error) {
            console.error('❌ Logout error:', error);
            return reply.code(500).send({ error: 'Internal server error' });
        }
    });

    // Get current user
    fastify.get('/me', { preHandler: [authenticate] }, async (request, reply) => {
        try {
            const tokenUser = request.user as { id: number };
            console.log('👤 Fetching user data for:', tokenUser.id);

            const user = await UserModel.findById(tokenUser.id);

            if (!user) {
                console.error('❌ User not found:', tokenUser.id);
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
        } catch (error) {
            console.error('❌ Get user error:', error);
            return reply.code(500).send({ error: 'Internal server error' });
        }
    });
};

export default authRoutes;