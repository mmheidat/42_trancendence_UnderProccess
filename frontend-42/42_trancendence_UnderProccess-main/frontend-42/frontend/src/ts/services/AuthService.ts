const API_BASE_URL = 'https://localhost:8443/api';

export interface User {
    id: number;
    username: string;
    email: string;
    display_name: string;
    avatar_url?: string;
    is_online: number;
    oauth_provider?: string;
}

export interface AuthResponse {
    message: string;
    token: string;
    user: User;
}

export class AuthService {
    private static instance: AuthService;
    private token: string | null = null;
    private currentUser: User | null = null;

    private constructor() {
        this.token = localStorage.getItem('auth_token');
    }

    static getInstance(): AuthService {
        if (!AuthService.instance) {
            AuthService.instance = new AuthService();
        }
        return AuthService.instance;
    }

    // Traditional login
    async login(email: string, password: string): Promise<AuthResponse> {
        const response = await fetch(`${API_BASE_URL}/auth/login`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ email, password }),
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Login failed');
        }

        const data: AuthResponse = await response.json();
        this.setAuth(data.token, data.user);
        return data;
    }

    // Register new user
    async register(username: string, email: string, password: string): Promise<AuthResponse> {
        const response = await fetch(`${API_BASE_URL}/auth/register`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ username, email, password }),
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Registration failed');
        }

        const data: AuthResponse = await response.json();
        this.setAuth(data.token, data.user);
        return data;
    }

    // Google Sign-in redirect
    googleSignIn(): void {
        console.log('Redirecting to Google OAuth...');
        window.location.href = `${API_BASE_URL}/auth/google`;
    }

    // Handle OAuth callback
    handleOAuthCallback(): boolean {
        console.log('🔐 [AUTH] handleOAuthCallback called');
        const urlParams = new URLSearchParams(window.location.search);
        const token = urlParams.get('token');
        const error = urlParams.get('message');

        console.log('🔐 [AUTH] URL params:', { hasToken: !!token, error });
        if (error) {
            console.error('OAuth error:', error);
            alert(`Authentication failed: ${error}`);
            window.history.replaceState({}, '', '/');
            return false;
        }

        if (token) {
            console.log('🔐 [AUTH] Token received (first 20 chars):', token.substring(0, 20) + '...');
            console.log('Token received from OAuth callback');
            this.token = token;
            localStorage.setItem('auth_token', token);
            
            // Fetch user data
            this.fetchCurrentUser().then(() => {
                console.log('User data fetched successfully');
                window.history.replaceState({}, '', '/');
                window.dispatchEvent(new Event('auth-success'));
            }).catch(err => {
                console.error('Failed to fetch user data:', err);
                this.logout();
            });
            return true;
        }
        console.log('🔐 [AUTH] No token or error in URL');
        return false;
    }

    // Fetch current user data
    async fetchCurrentUser(): Promise<User> {
        if (!this.token) {
            throw new Error('No authentication token');
        }

        const response = await fetch(`${API_BASE_URL}/auth/me`, {
            headers: {
                'Authorization': `Bearer ${this.token}`,
            },
        });

        if (!response.ok) {
            throw new Error('Failed to fetch user data');
        }

        const user: User = await response.json();
        this.currentUser = user;
        console.log('Current user set:', user);
        return user;
    }

    // Logout
    async logout(): Promise<void> {
        if (this.token) {
            try {
                await fetch(`${API_BASE_URL}/auth/logout`, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${this.token}`,
                    },
                });
            } catch (error) {
                console.error('Logout error:', error);
            }
        }

        this.token = null;
        this.currentUser = null;
        localStorage.removeItem('auth_token');
        window.dispatchEvent(new Event('auth-logout'));
    }

    // Set authentication
    private setAuth(token: string, user: User): void {
        this.token = token;
        this.currentUser = user;
        localStorage.setItem('auth_token', token);
    }

    // Check if user is authenticated
    isAuthenticated(): boolean {
        return this.token !== null;
    }

    // Get current user
    getCurrentUser(): User | null {
        return this.currentUser;
    }

    // Get auth token
    getToken(): string | null {
        return this.token;
    }
}