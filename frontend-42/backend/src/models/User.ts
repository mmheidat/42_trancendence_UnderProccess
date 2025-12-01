import db from '../config/database.js';
import bcrypt from 'bcrypt';

export interface User {
    id: number;
    username: string;
    email: string;
    password_hash: string;
    display_name: string;
    avatar_url?: string;
    date_of_birth?: string;
    nationality?: string;
    phone?: string;
    gender?: string;
    oauth_provider?: string;
    oauth_id?: string;
    is_online: number;
    last_seen: string;
    created_at: string;
    updated_at: string;
}

export class UserModel {
    static async create(data: {
        username: string;
        email: string;
        password: string;
        display_name?: string;
    }): Promise<User> {
        const hashedPassword = await bcrypt.hash(data.password, 10);
        const stmt = db.prepare(`
            INSERT INTO users (username, email, password_hash, display_name)
            VALUES (?, ?, ?, ?)
        `);
        
        const result = stmt.run(
            data.username,
            data.email,
            hashedPassword,
            data.display_name || data.username
        );

        return this.findById(result.lastInsertRowid as number)!;
    }

    static findById(id: number): User | undefined {
        const stmt = db.prepare('SELECT * FROM users WHERE id = ?');
        return stmt.get(id) as User | undefined;
    }

    static findByEmail(email: string): User | undefined {
        const stmt = db.prepare('SELECT * FROM users WHERE email = ?');
        return stmt.get(email) as User | undefined;
    }

    static findByUsername(username: string): User | undefined {
        const stmt = db.prepare('SELECT * FROM users WHERE username = ?');
        return stmt.get(username) as User | undefined;
    }

    static findByOAuth(provider: string, oauthId: string): User | undefined {
        const stmt = db.prepare('SELECT * FROM users WHERE oauth_provider = ? AND oauth_id = ?');
        return stmt.get(provider, oauthId) as User | undefined;
    }

    static createFromOAuth(data: {
        email: string;
        username: string;
        display_name: string;
        avatar_url?: string;
        oauth_provider: string;
        oauth_id: string;
    }): User {
        const stmt = db.prepare(`
            INSERT INTO users (username, email, password_hash, display_name, avatar_url, oauth_provider, oauth_id)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `);
        
        const result = stmt.run(
            data.username,
            data.email,
            '',
            data.display_name,
            data.avatar_url || null,
            data.oauth_provider,
            data.oauth_id
        );

        return this.findById(result.lastInsertRowid as number)!;
    }

    static linkOAuthAccount(userId: number, provider: string, oauthId: string): boolean {
        const stmt = db.prepare('UPDATE users SET oauth_provider = ?, oauth_id = ? WHERE id = ?');
        const result = stmt.run(provider, oauthId, userId);
        return result.changes > 0;
    }

    static updateOnlineStatus(userId: number, isOnline: boolean): boolean {
        const stmt = db.prepare('UPDATE users SET is_online = ?, last_seen = CURRENT_TIMESTAMP WHERE id = ?');
        const result = stmt.run(isOnline ? 1 : 0, userId);
        return result.changes > 0;
    }

    static getUserStats(userId: number): { wins: number; losses: number; total: number } {
        const stmt = db.prepare(`
            SELECT 
                SUM(CASE WHEN winner_id = ? THEN 1 ELSE 0 END) as wins,
                SUM(CASE WHEN (player1_id = ? OR player2_id = ?) AND winner_id != ? THEN 1 ELSE 0 END) as losses,
                COUNT(*) as total
            FROM games
            WHERE player1_id = ? OR player2_id = ?
        `);
        
        return stmt.get(userId, userId, userId, userId, userId, userId) as { wins: number; losses: number; total: number };
    }
}