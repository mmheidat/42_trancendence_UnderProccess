export class AuthCallback {
    constructor() {
        this.handleCallback();
    }

    private handleCallback(): void {
        const urlParams = new URLSearchParams(window.location.search);
        const token = urlParams.get('token');
        const error = urlParams.get('message');

        if (error) {
            alert(`Authentication failed: ${error}`);
            window.location.href = '/login';
            return;
        }

        if (token) {
            // Store token
            localStorage.setItem('auth_token', token);
            
            // Redirect to dashboard or home
            window.location.href = '/dashboard';
        } else {
            alert('Authentication failed: No token received');
            window.location.href = '/login';
        }
    }
}