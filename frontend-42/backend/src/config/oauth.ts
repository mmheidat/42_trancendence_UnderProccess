console.log('🔍 [OAuth Config] Loading environment variables...');
console.log('🔍 NODE_ENV:', process.env.NODE_ENV);
console.log('🔍 GOOGLE_CLIENT_ID:', process.env.GOOGLE_CLIENT_ID ? `${process.env.GOOGLE_CLIENT_ID.substring(0, 20)}...` : 'NOT SET');
console.log('🔍 GOOGLE_CLIENT_SECRET:', process.env.GOOGLE_CLIENT_SECRET ? 'SET' : 'NOT SET');
console.log('🔍 GOOGLE_REDIRECT_URI:', process.env.GOOGLE_REDIRECT_URI);

if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
    console.error('❌ CRITICAL: Google OAuth credentials not found in environment!');
    console.error('❌ Available env vars:', Object.keys(process.env).filter(k => k.includes('GOOGLE')));
    throw new Error('Missing Google OAuth credentials');
}

export const googleOAuthConfig = {
    name: 'googleOAuth2',
    credentials: {
        client: {
            id: process.env.GOOGLE_CLIENT_ID,
            secret: process.env.GOOGLE_CLIENT_SECRET
        },
        auth: {
            authorizeHost: 'https://accounts.google.com',
            authorizePath: '/o/oauth2/v2/auth',
            tokenHost: 'https://oauth2.googleapis.com',
            tokenPath: '/token'
        }
    },
    startRedirectPath: '/api/auth/google',
    callbackUri: process.env.GOOGLE_REDIRECT_URI || 'http://localhost:3001/api/auth/google/callback',
    scope: ['email', 'profile'],
    generateStateFunction: () => {
        const state = Math.random().toString(36).substring(2, 15);
        console.log('🔐 Generated state:', state);
        return state;
    },
    checkStateFunction: (request: any, callback: (err?: Error) => void) => {
        console.log('🔐 Checking state...');
        console.log('🔐 Request query:', request.query);
        console.log('🔐 Request cookies:', request.cookies);
        
        const state = request.query.state;
        const storedState = request.cookies['oauth2-redirect-state'];
        
        console.log('🔐 State from URL:', state);
        console.log('🔐 State from cookie:', storedState);
        
        if (!state || !storedState) {
            console.log('❌ Missing state or stored state');
            callback(new Error('Invalid state'));
            return;
        }
        
        if (state === storedState) {
            console.log('✅ State matches!');
            callback();
        } else {
            console.log('❌ State mismatch');
            callback(new Error('Invalid state'));
        }
    }
};

export const GOOGLE_USER_INFO_URL = 'https://www.googleapis.com/oauth2/v2/userinfo';

console.log('✅ [OAuth Config] Configuration loaded successfully');
console.log('✅ Client ID starts with:', process.env.GOOGLE_CLIENT_ID?.substring(0, 20));
console.log('✅ Redirect URI:', googleOAuthConfig.callbackUri);