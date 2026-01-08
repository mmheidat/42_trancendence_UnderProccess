import Game from './game';
import { AuthService } from './services/AuthService.js';

// Auth Service
const authService = AuthService.getInstance();

// Main elements
const loginCard = document.getElementById('loginCard') as HTMLElement;
const loginForm = document.getElementById('loginForm') as HTMLFormElement;
const registerCard = document.getElementById('registerCard') as HTMLElement;
const registerForm = document.getElementById('registerForm') as HTMLFormElement;
const registerError = document.getElementById('registerError') as HTMLElement;
const showRegisterLink = document.getElementById('showRegister') as HTMLAnchorElement;
const showLoginLink = document.getElementById('showLogin') as HTMLAnchorElement;
const googleLoginBtn = document.getElementById('googleLogin') as HTMLButtonElement;
const googleRegisterBtn = document.getElementById('googleRegister') as HTMLButtonElement;
const mainApp = document.getElementById('mainApp') as HTMLElement;
const authCallback = document.getElementById('authCallback') as HTMLElement;
const playerNameDisplay = document.getElementById('playerNameDisplay') as HTMLElement;

// Navigation buttons
const navPlay = document.getElementById('navPlay') as HTMLButtonElement;
const navLeaderboard = document.getElementById('navLeaderboard') as HTMLButtonElement;
const navProfile = document.getElementById('navProfile') as HTMLButtonElement;
const navChat = document.getElementById('navChat') as HTMLButtonElement;
const navSettings = document.getElementById('navSettings') as HTMLButtonElement;
const navLogout = document.getElementById('navLogout') as HTMLButtonElement;

// Language controls
const languageSelector = document.getElementById('languageSelector') as HTMLSelectElement;

// Content sections
const welcomeSection = document.getElementById('welcomeSection') as HTMLElement;
const gameContainer = document.getElementById('game-container') as HTMLElement;
const leaderboardSection = document.getElementById('leaderboardSection') as HTMLElement;
const profileSection = document.getElementById('profileSection') as HTMLElement;
const chatSection = document.getElementById('chatSection') as HTMLElement;
const settingsSection = document.getElementById('settingsSection') as HTMLElement;

// Chat functionality
const friendItems = document.querySelectorAll('.friend-item');
const noChatSelected = document.getElementById('noChatSelected') as HTMLElement;
const chatWindow = document.getElementById('chatWindow') as HTMLElement;
const chatFriendName = document.getElementById('chatFriendName') as HTMLElement;
const chatInput = document.getElementById('chatInput') as HTMLInputElement;
const sendMessageBtn = document.getElementById('sendMessageBtn') as HTMLButtonElement;
const chatMessages = document.getElementById('chatMessages') as HTMLElement;
const viewProfileBtn = document.getElementById('viewProfileBtn') as HTMLButtonElement;
const inviteToGameBtn = document.getElementById('inviteToGameBtn') as HTMLButtonElement;
const friendOptionsBtn = document.getElementById('friendOptionsBtn') as HTMLButtonElement;
const friendOptionsMenu = document.getElementById('friendOptionsMenu') as HTMLElement;

// Game variables
let currentGame: Game | null = null;

// Game mode elements
const gameModeSelection = document.getElementById('gameModeSelection') as HTMLElement;
const aiDifficultySelection = document.getElementById('aiDifficultySelection') as HTMLElement;
const multiplayerMatchmaking = document.getElementById('multiplayerMatchmaking') as HTMLElement;
const actualGameCanvas = document.getElementById('actualGameCanvas') as HTMLElement;

const selectAIMode = document.getElementById('selectAIMode') as HTMLButtonElement;
const selectMultiplayerMode = document.getElementById('selectMultiplayerMode') as HTMLButtonElement;
const backToMenu = document.getElementById('backToMenu') as HTMLButtonElement;
const backToGameMode = document.getElementById('backToGameMode') as HTMLButtonElement;
const startAIGameBtns = document.querySelectorAll('.start-ai-game');
const cancelMatchmaking = document.getElementById('cancelMatchmaking') as HTMLButtonElement;
const quitGame = document.getElementById('quitGame') as HTMLButtonElement;

const searchTimer = document.getElementById('searchTimer') as HTMLElement;
const queueCount = document.getElementById('queueCount') as HTMLElement;
const gameMode = document.getElementById('gameMode') as HTMLElement;
const gameDifficulty = document.getElementById('gameDifficulty') as HTMLElement;

// Settings elements
const avatarUpload = document.getElementById('avatarUpload') as HTMLInputElement;
const currentAvatar = document.getElementById('currentAvatar') as HTMLElement;
const updateUsernameBtn = document.getElementById('updateUsernameBtn') as HTMLButtonElement;
const saveSettingsBtn = document.getElementById('saveSettingsBtn') as HTMLButtonElement;


let matchmakingInterval: number | null = null;
let matchmakingTime: number = 0;
let isNavigating = false;
let eventListenersSetup = false;

type SectionType = 'game' | 'leaderboard' | 'profile' | 'chat' | 'settings' | 'welcome';

// ============================================================================
// INITIALIZATION
// ============================================================================


async function initializeApp(): Promise<void> {
    console.log('Initializing app...');

    // Setup event listeners first, before any authentication flow
    setupEventListeners();

    // Check for OAuth callback
    if (window.location.search.includes('token=')) {
        console.log('🎮 [FRONTEND] OAuth token detected in URL');
        showAuthCallback();
        const success = authService.handleOAuthCallback();
        console.log('🎮 [FRONTEND] OAuth callback handled, success:', success);

        if (success) {
            console.log('🎮 [FRONTEND] Waiting for auth-success event...');
            await new Promise(resolve => {
                window.addEventListener('auth-success', resolve, { once: true });
            });
            console.log('🎮 [FRONTEND] Auth success event received');
            onAuthSuccess();
        } else {
            console.error('🎮 [FRONTEND] OAuth callback failed');
            hideAuthCallback();
            showLogin();
        }
        return;
    }

    // Check if user is already authenticated
    const savedToken = localStorage.getItem('auth_token');
    console.log('🎮 [FRONTEND] Saved token exists:', !!savedToken);

    if (authService.isAuthenticated()) {
        console.log('🎮 [FRONTEND] User is authenticated, fetching user data...');
        try {
            await authService.fetchCurrentUser();
            console.log('🎮 [FRONTEND] User data fetched successfully');
            onAuthSuccess();
        } catch (error) {
            console.error('🎮 [FRONTEND] Failed to fetch user:', error);
            await authService.logout();
            showLogin();
        }
    } else {
        console.log('🎮 [FRONTEND] No authentication, showing login');
        showLogin();
    }
}

function showLogin(): void {
    loginCard.classList.remove('hidden');
    registerCard.classList.add('hidden');
    mainApp.classList.add('hidden');
    authCallback.classList.add('hidden');
    document.body.classList.add('overflow-hidden');
}

function showAuthCallback(): void {
    loginCard.classList.add('hidden');
    mainApp.classList.add('hidden');
    authCallback.classList.remove('hidden');
}

function hideAuthCallback(): void {
    authCallback.classList.add('hidden');
}

function onAuthSuccess(): void {
    const user = authService.getCurrentUser();

    if (user) {
        console.log('User authenticated:', user);

        // Update UI with user data
        if (playerNameDisplay) {
            playerNameDisplay.textContent = `Welcome, ${user.display_name || user.username}!`;
        }

        // Update profile
        const profilePlayerName = document.getElementById('profilePlayerName');
        if (profilePlayerName) {
            profilePlayerName.textContent = user.display_name || user.username;
        }

        // Update settings
        const settingsUsername = document.getElementById('settingsUsername') as HTMLInputElement;
        if (settingsUsername) {
            settingsUsername.value = user.username;
        }

        const settingsEmail = document.getElementById('settingsEmail') as HTMLInputElement;
        if (settingsEmail) {
            settingsEmail.value = user.email;
        }

        // Update avatar if available
        if (user.avatar_url) {
            updateAvatarImage(user.avatar_url);
        }
    }

    loginCard.classList.add('hidden');
    registerCard.classList.add('hidden');
    authCallback.classList.add('hidden');
    mainApp.classList.remove('hidden');
    document.body.classList.remove('overflow-hidden');

    // Initialize with welcome section
    showSection('welcome', true);
}

function updateAvatarImage(avatarUrl: string): void {
    const avatarElements = document.querySelectorAll('[id^="currentAvatar"], [id^="chatAvatar"]');
    avatarElements.forEach(element => {
        if (element instanceof HTMLElement) {
            element.style.backgroundImage = `url(${avatarUrl})`;
            element.style.backgroundSize = 'cover';
            element.style.backgroundPosition = 'center';
            element.textContent = '';
        }
    });
}

// ============================================================================
// EVENT LISTENERS
// ============================================================================

function setupEventListeners(): void {
    // Prevent duplicate event listener registration
    if (eventListenersSetup) {
        console.log('Event listeners already set up, skipping...');
        return;
    }

    console.log('Setting up event listeners...');
    eventListenersSetup = true;

    // Google Sign-in
    googleLoginBtn?.addEventListener('click', (e) => {
        e.preventDefault();
        console.log('Starting Google OAuth flow...');
        authService.googleSignIn();
    });

    // Traditional login
    loginForm?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const formData = new FormData(loginForm);
        const email = formData.get('email') as string || formData.get('username') as string;
        const password = formData.get('password') as string;

        try {
            await authService.login(email, password);
            onAuthSuccess();
        } catch (error) {
            alert(error instanceof Error ? error.message : 'Login failed');
        }
    });

    // Registration form handler
    registerForm?.addEventListener('submit', async (e) => {
        e.preventDefault();
        registerError.classList.add('hidden');

        const formData = new FormData(registerForm);
        const username = formData.get('username') as string;
        const email = formData.get('email') as string;
        const password = formData.get('password') as string;
        const passwordConfirm = formData.get('passwordConfirm') as string;

        // Client-side validation
        if (password !== passwordConfirm) {
            registerError.textContent = 'Passwords do not match';
            registerError.classList.remove('hidden');
            return;
        }

        if (password.length < 8) {
            registerError.textContent = 'Password must be at least 8 characters';
            registerError.classList.remove('hidden');
            return;
        }

        if (username.length < 3 || username.length > 20) {
            registerError.textContent = 'Username must be between 3 and 20 characters';
            registerError.classList.remove('hidden');
            return;
        }

        try {
            await authService.register(username, email, password);
            // Auto-login after successful registration
            onAuthSuccess();
        } catch (error) {
            registerError.textContent = error instanceof Error ? error.message : 'Registration failed';
            registerError.classList.remove('hidden');
        }
    });

    // Toggle between login and register
    showRegisterLink?.addEventListener('click', (e) => {
        e.preventDefault();
        loginCard.classList.add('hidden');
        registerCard.classList.remove('hidden');
    });

    showLoginLink?.addEventListener('click', (e) => {
        e.preventDefault();
        registerCard.classList.add('hidden');
        loginCard.classList.remove('hidden');
        registerError.classList.add('hidden');
    });

    // Google register button (same as login)
    googleRegisterBtn?.addEventListener('click', (e) => {
        e.preventDefault();
        console.log('Starting Google OAuth flow from register...');
        authService.googleSignIn();
    });

    // Logout
    navLogout?.addEventListener('click', async () => {
        await authService.logout();
        showLogin();
        // Reset sections
        showSection('welcome', false);
    });

    // Navigation
    navPlay?.addEventListener('click', () => showSection('game'));
    navLeaderboard?.addEventListener('click', () => showSection('leaderboard'));
    navProfile?.addEventListener('click', () => showSection('profile'));
    navChat?.addEventListener('click', () => showSection('chat'));
    navSettings?.addEventListener('click', () => showSection('settings'));

    // Language selector
    languageSelector?.addEventListener('change', (e: Event) => {
        const target = e.target as HTMLSelectElement;
        console.log('Language changed to:', target.value);
    });

    // Game mode selection
    selectAIMode?.addEventListener('click', () => {
        gameModeSelection.classList.add('hidden');
        aiDifficultySelection.classList.remove('hidden');
    });

    selectMultiplayerMode?.addEventListener('click', () => {
        gameModeSelection.classList.add('hidden');
        startMatchmaking();
    });

    backToMenu?.addEventListener('click', () => {
        window.history.back();
    });

    backToGameMode?.addEventListener('click', () => {
        aiDifficultySelection.classList.add('hidden');
        gameModeSelection.classList.remove('hidden');
    });

    // Start AI game
    startAIGameBtns.forEach(btn => {
        btn.addEventListener('click', function (this: HTMLElement) {
            const difficulty = this.getAttribute('data-difficulty');
            if (difficulty) startAIGame(difficulty);
        });
    });

    cancelMatchmaking?.addEventListener('click', () => {
        stopMatchmaking();
        multiplayerMatchmaking.classList.add('hidden');
        gameModeSelection.classList.remove('hidden');
    });

    quitGame?.addEventListener('click', () => {
        if (currentGame) {
            currentGame.stop();
            currentGame = null;
        }
        actualGameCanvas.classList.add('hidden');
        gameModeSelection.classList.remove('hidden');
        (document.getElementById('player1Score') as HTMLElement).textContent = '0';
        (document.getElementById('player2Score') as HTMLElement).textContent = '0';
    });

    // Chat functionality
    setupChatListeners();

    // Settings functionality
    setupSettingsListeners();
}

// ============================================================================
// CHAT FUNCTIONALITY
// ============================================================================

function setupChatListeners(): void {
    friendItems.forEach(item => {
        item.addEventListener('click', function (this: HTMLElement) {
            const friendName = this.getAttribute('data-friend');
            if (friendName) openChat(friendName);
        });
    });

    sendMessageBtn?.addEventListener('click', sendMessage);
    chatInput?.addEventListener('keypress', (e: KeyboardEvent) => {
        if (e.key === 'Enter') sendMessage();
    });

    viewProfileBtn?.addEventListener('click', () => showSection('profile'));

    inviteToGameBtn?.addEventListener('click', () => {
        const friendName = chatFriendName.textContent;
        alert(`Game invitation sent to ${friendName}!`);
    });

    friendOptionsBtn?.addEventListener('click', () => {
        friendOptionsMenu.classList.toggle('hidden');
    });

    document.addEventListener('click', (e: MouseEvent) => {
        if (!friendOptionsBtn?.contains(e.target as Node) &&
            !friendOptionsMenu?.contains(e.target as Node)) {
            friendOptionsMenu?.classList.add('hidden');
        }
    });
}

function openChat(friendName: string): void {
    noChatSelected.classList.add('hidden');
    chatWindow.classList.remove('hidden');
    chatFriendName.textContent = friendName;
}

function sendMessage(): void {
    const message = chatInput.value.trim();
    if (message) {
        const messageDiv = document.createElement('div');
        messageDiv.className = 'flex items-start space-x-2 justify-end';
        messageDiv.innerHTML = `
            <div>
                <div class="bg-purple-600 rounded-lg p-3 max-w-xs">
                    <p class="text-white text-sm">${message}</p>
                </div>
                <p class="text-gray-500 text-xs mt-1 mr-2 text-right">
                    ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </p>
            </div>
        `;
        chatMessages.appendChild(messageDiv);
        chatInput.value = '';
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }
}

// ============================================================================
// SETTINGS FUNCTIONALITY
// ============================================================================

function setupSettingsListeners(): void {
    avatarUpload?.addEventListener('change', (e: Event) => {
        const target = e.target as HTMLInputElement;
        const file = target.files?.[0];
        if (file) {
            if (file.size > 2 * 1024 * 1024) {
                alert('File size must be less than 2MB');
                return;
            }

            const reader = new FileReader();
            reader.onload = (event: ProgressEvent<FileReader>) => {
                if (event.target?.result) {
                    currentAvatar.innerHTML = `<img src="${event.target.result}" class="w-24 h-24 rounded-full object-cover">`;
                }
            };
            reader.readAsDataURL(file);
        }
    });

    updateUsernameBtn?.addEventListener('click', () => {
        const usernameInput = document.getElementById('settingsUsername') as HTMLInputElement;
        const newUsername = usernameInput.value.trim();
        if (newUsername) {
            playerNameDisplay.textContent = `Welcome, ${newUsername}!`;
            const profilePlayerName = document.getElementById('profilePlayerName');
            if (profilePlayerName) {
                profilePlayerName.textContent = newUsername;
            }
            alert('Username updated successfully!');
        }
    });

    saveSettingsBtn?.addEventListener('click', () => {
        const settings = {
            username: (document.getElementById('settingsUsername') as HTMLInputElement).value,
            email: (document.getElementById('settingsEmail') as HTMLInputElement).value,
            dob: (document.getElementById('settingsDOB') as HTMLInputElement).value,
            nationality: (document.getElementById('settingsNationality') as HTMLSelectElement).value,
            phone: (document.getElementById('settingsPhone') as HTMLInputElement).value,
            gender: (document.getElementById('settingsGender') as HTMLSelectElement).value
        };

        console.log('Settings saved:', settings);
        alert('Settings saved successfully!');
    });
}

// ============================================================================
// GAME FUNCTIONALITY
// ============================================================================

function startAIGame(difficulty: string): void {
    aiDifficultySelection.classList.add('hidden');
    actualGameCanvas.classList.remove('hidden');

    gameMode.textContent = `VS AI - ${difficulty.toUpperCase()}`;
    gameDifficulty.textContent = `Difficulty: ${difficulty}`;

    try {
        currentGame = new Game('gameCanvas', true, difficulty as 'easy' | 'medium' | 'hard');
        currentGame.start();
    } catch (error) {
        console.error('Failed to start game:', error);
        alert('Failed to start game. Please try again.');
        actualGameCanvas.classList.add('hidden');
        gameModeSelection.classList.remove('hidden');
    }
}

function startMatchmaking(): void {
    multiplayerMatchmaking.classList.remove('hidden');
    matchmakingTime = 0;

    matchmakingInterval = window.setInterval(() => {
        matchmakingTime++;
        const minutes = Math.floor(matchmakingTime / 60);
        const seconds = matchmakingTime % 60;
        searchTimer.textContent = `${minutes}:${String(seconds).padStart(2, '0')}`;

        if (matchmakingTime === 5) {
            stopMatchmaking();
            startMultiplayerGame();
        }

        queueCount.textContent = String(Math.floor(Math.random() * 10) + 1);
    }, 1000);
}

function stopMatchmaking(): void {
    if (matchmakingInterval !== null) {
        clearInterval(matchmakingInterval);
        matchmakingInterval = null;
    }
    matchmakingTime = 0;
}

function startMultiplayerGame(): void {
    multiplayerMatchmaking.classList.add('hidden');
    actualGameCanvas.classList.remove('hidden');

    gameMode.textContent = 'Multiplayer Match';
    gameDifficulty.textContent = 'Opponent: Player X';

    console.log('Starting multiplayer game');
    currentGame = new Game('gameCanvas', false);
    currentGame.start();
}

// ============================================================================
// SECTION NAVIGATION
// ============================================================================

function showSection(section: SectionType, addToHistory: boolean = true): void {
    if (currentGame) {
        currentGame.stop();
        currentGame = null;
    }

    if (addToHistory && !isNavigating) {
        window.history.pushState({ section }, '', `#${section}`);
    }

    // Hide all sections
    welcomeSection.classList.add('hidden');
    gameContainer.classList.add('hidden');
    leaderboardSection.classList.add('hidden');
    profileSection.classList.add('hidden');
    chatSection.classList.add('hidden');
    settingsSection.classList.add('hidden');

    // Reset game UI
    gameModeSelection.classList.remove('hidden');
    aiDifficultySelection.classList.add('hidden');
    multiplayerMatchmaking.classList.add('hidden');
    actualGameCanvas.classList.add('hidden');
    stopMatchmaking();

    (document.getElementById('player1Score') as HTMLElement).textContent = '0';
    (document.getElementById('player2Score') as HTMLElement).textContent = '0';

    // Show selected section
    switch (section) {
        case 'game':
            gameContainer.classList.remove('hidden');
            break;
        case 'leaderboard':
            leaderboardSection.classList.remove('hidden');
            break;
        case 'profile':
            profileSection.classList.remove('hidden');
            break;
        case 'chat':
            chatSection.classList.remove('hidden');
            break;
        case 'settings':
            settingsSection.classList.remove('hidden');
            break;
        case 'welcome':
            welcomeSection.classList.remove('hidden');
            break;
    }
}

// ============================================================================
// BROWSER HISTORY HANDLING
// ============================================================================

window.addEventListener('popstate', (event) => {
    isNavigating = true;
    if (event.state && event.state.section) {
        showSection(event.state.section as SectionType, false);
    } else {
        showSection('welcome', false);
    }
    isNavigating = false;
});

window.addEventListener('load', () => {
    if (!window.location.hash) {
        window.history.replaceState({ section: 'welcome' }, '', '#welcome');
    }
});

// ============================================================================
// START APPLICATION
// ============================================================================

document.addEventListener('DOMContentLoaded', () => {
    initializeApp();
});