import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import bcrypt from 'bcrypt';
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

    // Traditional register
    fastify.post('/register', async (request, reply) => {
        try {
            console.log('📝 Register request received');
            const body = registerSchema.parse(request.body);

            const existingUser = UserModel.findByEmail(body.email) || UserModel.findByUsername(body.username);
            
            if (existingUser) {
                console.log('❌ User already exists:', body.email);
                return reply.code(409).send({ error: 'User already exists' });
            }

            const user = await UserModel.create(body);
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
                    display_name: user.display_name,
                    avatar_url: user.avatar_url
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

    // Traditional login
    fastify.post('/login', async (request, reply) => {
        try {
            console.log('🔐 Login request received');
            const body = loginSchema.parse(request.body);

            const user = UserModel.findByEmail(body.email);
            if (!user) {
                console.log('❌ User not found:', body.email);
                return reply.code(401).send({ error: 'Invalid credentials' });
            }

            if (user.oauth_provider && !user.password_hash) {
                console.log('❌ OAuth user trying traditional login:', body.email);
                return reply.code(400).send({ error: `Please sign in with ${user.oauth_provider}` });
            }

            const validPassword = await bcrypt.compare(body.password, user.password_hash);
            if (!validPassword) {
                console.log('❌ Invalid password for:', body.email);
                return reply.code(401).send({ error: 'Invalid credentials' });
            }

            UserModel.updateOnlineStatus(user.id, true);
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
                    display_name: user.display_name,
                    avatar_url: user.avatar_url,
                    is_online: user.is_online
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
            console.log('🔵 Client ID:', googleOAuthConfig.credentials.client.id);
            console.log('🔵 Callback URI:', googleOAuthConfig.callbackUri);
            console.log('🔵 Scopes:', googleOAuthConfig.scope);

            const authUrl = await fastify.googleOAuth2.generateAuthorizationUri(request, reply);
            console.log('🔵 [STEP 2] Generated auth URL:', authUrl);
            console.log('🔵 Redirecting user to Google...');

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
            console.log('🟢 Query params:', JSON.stringify(request.query, null, 2));
            console.log('🟢 URL:', request.url);

            // Get the token using the OAuth2 plugin
            console.log('🟢 [STEP 4] Exchanging code for access token...');
            const result = await fastify.googleOAuth2.getAccessTokenFromAuthorizationCodeFlow(request);
            
            console.log('🟢 [STEP 5] Token exchange result:', {
                hasToken: !!result,
                hasAccessToken: !!result?.token?.access_token,
                tokenType: result?.token?.token_type,
                expiresIn: result?.token?.expires_in,
                scope: result?.token?.scope
            });

            if (!result || !result.token || !result.token.access_token) {
                console.error('❌ No access token in result. Full result:', JSON.stringify(result, null, 2));
                const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:8080';
                return reply.redirect(`${frontendUrl}?message=Failed to get access token`);
            }

            console.log('🟢 [STEP 6] Access token received successfully');
            console.log('🟢 Access token (first 20 chars):', result.token.access_token.substring(0, 20) + '...');

            // Fetch user info from Google
            console.log('🟢 [STEP 7] Fetching user info from Google API...');
            const response = await axios.get<GoogleUserInfo>(GOOGLE_USER_INFO_URL, {
                headers: { 
                    Authorization: `Bearer ${result.token.access_token}` 
                }
            });

            const googleUser = response.data;
            console.log('🟢 [STEP 8] Google user info received:', {
                id: googleUser.id,
                email: googleUser.email,
                name: googleUser.name,
                verified: googleUser.verified_email,
                picture: googleUser.picture
            });

            if (!googleUser.verified_email) {
                console.error('❌ Email not verified:', googleUser.email);
                const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:8080';
                return reply.redirect(`${frontendUrl}?message=Email not verified`);
            }

            // Check if user exists with OAuth
            console.log('🟢 [STEP 9] Checking if user exists...');
            let user = UserModel.findByOAuth('google', googleUser.id);
            console.log('🟢 User found by OAuth:', !!user);

            if (!user) {
                // Check if user exists with same email
                user = UserModel.findByEmail(googleUser.email);
                console.log('🟢 User found by email:', !!user);

                if (user) {
                    // Link OAuth to existing account
                    console.log('🟢 [STEP 10] Linking Google to existing user:', user.id);
                    UserModel.linkOAuthAccount(user.id, 'google', googleUser.id);
                } else {
                    // Create new user
                    const username = googleUser.email.split('@')[0] + '_' + Date.now().toString().slice(-4);
                    console.log('🟢 [STEP 10] Creating new user:', {
                        email: googleUser.email,
                        username: username,
                        display_name: googleUser.name
                    });
                    
                    user = UserModel.createFromOAuth({
                        email: googleUser.email,
                        username,
                        display_name: googleUser.name,
                        avatar_url: googleUser.picture,
                        oauth_provider: 'google',
                        oauth_id: googleUser.id
                    });
                    console.log('🟢 New user created with ID:', user.id);
                }
            }

            // Update online status
            console.log('🟢 [STEP 11] Updating online status for user:', user.id);
            UserModel.updateOnlineStatus(user.id, true);

            // Generate JWT token
            console.log('🟢 [STEP 12] Generating JWT token...');
            const jwtToken = fastify.jwt.sign({ 
                id: user.id, 
                email: user.email,
                username: user.username 
            });
            console.log('🟢 JWT token generated (first 20 chars):', jwtToken.substring(0, 20) + '...');

            console.log('🟢 [STEP 13] User authenticated successfully:', {
                userId: user.id,
                email: user.email,
                username: user.username
            });

            // Redirect to frontend with token
            const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:8080';
            const redirectUrl = `${frontendUrl}?token=${jwtToken}`;
            console.log('🟢 [STEP 14] Redirecting to frontend:', redirectUrl);

            return reply.redirect(redirectUrl);

        } catch (error) {
            console.error('❌ Google OAuth callback error:', error);
            console.error('❌ Error stack:', error instanceof Error ? error.stack : 'No stack trace');
            const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:8080';
            return reply.redirect(`${frontendUrl}?message=Authentication failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    });

    // Logout
    fastify.post('/logout', { preHandler: [authenticate] }, async (request, reply) => {
        try {
            const user = request.user as any;
            console.log('👋 User logging out:', user.id);
            UserModel.updateOnlineStatus(user.id, false);
            return reply.send({ message: 'Logged out successfully' });
        } catch (error) {
            console.error('❌ Logout error:', error);
            return reply.code(500).send({ error: 'Internal server error' });
        }
    });

    // Get current user
    fastify.get('/me', { preHandler: [authenticate] }, async (request, reply) => {
        try {
            const user = request.user as any;
            console.log('👤 Fetching user data for:', user.id);
            const fullUser = UserModel.findById(user.id);
            
            if (!fullUser) {
                console.error('❌ User not found:', user.id);
                return reply.code(404).send({ error: 'User not found' });
            }

            console.log('✅ User data retrieved:', {
                id: fullUser.id,
                email: fullUser.email,
                username: fullUser.username
            });

            return reply.send({
                id: fullUser.id,
                username: fullUser.username,
                email: fullUser.email,
                display_name: fullUser.display_name,
                avatar_url: fullUser.avatar_url,
                nationality: fullUser.nationality,
                is_online: fullUser.is_online,
                oauth_provider: fullUser.oauth_provider,
                created_at: fullUser.created_at
            });
        } catch (error) {
            console.error('❌ Get user error:', error);
            return reply.code(500).send({ error: 'Internal server error' });
        }
    });
};

export default authRoutes;