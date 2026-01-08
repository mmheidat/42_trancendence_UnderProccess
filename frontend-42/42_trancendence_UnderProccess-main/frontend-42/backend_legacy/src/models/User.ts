import prisma from '../lib/prisma.js';
import bcrypt from 'bcrypt';
import { User } from '@prisma/client';

// Re-export User type from Prisma
export type { User };

// User response type (without sensitive fields)
export interface UserResponse {
    id: number;
    username: string;
    email: string;
    displayName: string;
    avatarUrl: string | null;
    dateOfBirth: string | null;
    nationality: string | null;
    phone: string | null;
    gender: string | null;
    oauthProvider: string | null;
    isOnline: boolean;
    lastSeen: Date;
    createdAt: Date;
}

export class UserModel {
    /**
     * Create a new user with password
     */
    static async create(data: {
        username: string;
        email: string;
        password: string;
        displayName?: string;
    }): Promise<User> {
        const hashedPassword = await bcrypt.hash(data.password, 10);

        return prisma.user.create({
            data: {
                username: data.username,
                email: data.email,
                passwordHash: hashedPassword,
                displayName: data.displayName || data.username,
            },
        });
    }

    /**
     * Find user by ID
     */
    static async findById(id: number): Promise<User | null> {
        return prisma.user.findUnique({
            where: { id },
        });
    }

    /**
     * Find user by email
     */
    static async findByEmail(email: string): Promise<User | null> {
        return prisma.user.findUnique({
            where: { email },
        });
    }

    /**
     * Find user by username
     */
    static async findByUsername(username: string): Promise<User | null> {
        return prisma.user.findUnique({
            where: { username },
        });
    }

    /**
     * Find user by OAuth provider and ID
     */
    static async findByOAuth(provider: string, oauthId: string): Promise<User | null> {
        return prisma.user.findFirst({
            where: {
                oauthProvider: provider,
                oauthId: oauthId,
            },
        });
    }

    /**
     * Create user from OAuth provider
     */
    static async createFromOAuth(data: {
        email: string;
        username: string;
        displayName: string;
        avatarUrl?: string;
        oauthProvider: string;
        oauthId: string;
    }): Promise<User> {
        return prisma.user.create({
            data: {
                email: data.email,
                username: data.username,
                displayName: data.displayName,
                avatarUrl: data.avatarUrl || null,
                oauthProvider: data.oauthProvider,
                oauthId: data.oauthId,
                passwordHash: '',
            },
        });
    }

    /**
     * Link OAuth account to existing user
     */
    static async linkOAuthAccount(userId: number, provider: string, oauthId: string): Promise<boolean> {
        const result = await prisma.user.update({
            where: { id: userId },
            data: {
                oauthProvider: provider,
                oauthId: oauthId,
            },
        });
        return !!result;
    }

    /**
     * Update user online status
     */
    static async updateOnlineStatus(userId: number, isOnline: boolean): Promise<boolean> {
        const result = await prisma.user.update({
            where: { id: userId },
            data: {
                isOnline: isOnline,
                lastSeen: new Date(),
            },
        });
        return !!result;
    }

    /**
     * Get user game statistics
     */
    static async getUserStats(userId: number): Promise<{ wins: number; losses: number; total: number }> {
        const [wins, losses, total] = await Promise.all([
            prisma.game.count({
                where: { winnerId: userId },
            }),
            prisma.game.count({
                where: {
                    OR: [
                        { player1Id: userId },
                        { player2Id: userId },
                    ],
                    NOT: { winnerId: userId },
                    winnerId: { not: null },
                },
            }),
            prisma.game.count({
                where: {
                    OR: [
                        { player1Id: userId },
                        { player2Id: userId },
                    ],
                },
            }),
        ]);

        return { wins, losses, total };
    }

    /**
     * Verify user password
     */
    static async verifyPassword(user: User, password: string): Promise<boolean> {
        if (!user.passwordHash) {
            return false;
        }
        return bcrypt.compare(password, user.passwordHash);
    }
}