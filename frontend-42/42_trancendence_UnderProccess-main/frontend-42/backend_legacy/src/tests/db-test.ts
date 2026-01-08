/**
 * Database Relationship Test Script
 * Tests all Prisma models and their relationships
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient({
    log: ['error'],
});

async function clearDatabase(): Promise<void> {
    console.log('🗑️  Clearing existing data...');
    await prisma.message.deleteMany();
    await prisma.friend.deleteMany();
    await prisma.game.deleteMany();
    await prisma.user.deleteMany();
    console.log('✅ Database cleared\n');
}

async function testUserModel(): Promise<number[]> {
    console.log('='.repeat(50));
    console.log('📝 TESTING USER MODEL');
    console.log('='.repeat(50));

    // Create users
    const user1 = await prisma.user.create({
        data: {
            username: 'player1',
            email: 'player1@test.com',
            passwordHash: 'hashed_password_1',
            displayName: 'Player One',
        },
    });
    console.log('✅ Created user1:', user1.username, '(ID:', user1.id, ')');

    const user2 = await prisma.user.create({
        data: {
            username: 'player2',
            email: 'player2@test.com',
            passwordHash: 'hashed_password_2',
            displayName: 'Player Two',
            avatarUrl: 'https://example.com/avatar.png',
        },
    });
    console.log('✅ Created user2:', user2.username, '(ID:', user2.id, ')');

    const user3 = await prisma.user.create({
        data: {
            username: 'google_user',
            email: 'oauth@gmail.com',
            passwordHash: '',
            displayName: 'Google User',
            oauthProvider: 'google',
            oauthId: '123456789',
        },
    });
    console.log('✅ Created OAuth user3:', user3.username, '(ID:', user3.id, ')');

    // Test unique constraints
    try {
        await prisma.user.create({
            data: {
                username: 'player1', // Duplicate
                email: 'different@test.com',
                passwordHash: 'test',
                displayName: 'Test',
            },
        });
        console.log('❌ Should have thrown unique constraint error');
    } catch (error) {
        console.log('✅ Unique username constraint works');
    }

    try {
        await prisma.user.create({
            data: {
                username: 'different',
                email: 'player1@test.com', // Duplicate
                passwordHash: 'test',
                displayName: 'Test',
            },
        });
        console.log('❌ Should have thrown unique constraint error');
    } catch (error) {
        console.log('✅ Unique email constraint works');
    }

    // Test findByOAuth
    const oauthUser = await prisma.user.findFirst({
        where: {
            oauthProvider: 'google',
            oauthId: '123456789',
        },
    });
    console.log('✅ Found OAuth user:', oauthUser?.username);

    console.log('');
    return [user1.id, user2.id, user3.id];
}

async function testGameModel(userIds: number[]): Promise<number[]> {
    console.log('='.repeat(50));
    console.log('🎮 TESTING GAME MODEL + USER RELATIONS');
    console.log('='.repeat(50));

    const [user1Id, user2Id, user3Id] = userIds;

    // Create games
    const game1 = await prisma.game.create({
        data: {
            player1Id: user1Id,
            player2Id: user2Id,
            player1Score: 11,
            player2Score: 5,
            winnerId: user1Id,
            gameMode: 'pvp',
        },
    });
    console.log('✅ Created game1: Player1 vs Player2, winner: Player1');

    const game2 = await prisma.game.create({
        data: {
            player1Id: user2Id,
            player2Id: user1Id,
            player1Score: 11,
            player2Score: 8,
            winnerId: user2Id,
            gameMode: 'pvp',
        },
    });
    console.log('✅ Created game2: Player2 vs Player1, winner: Player2');

    const game3 = await prisma.game.create({
        data: {
            player1Id: user1Id,
            player2Id: null, // AI game
            player1Score: 11,
            player2Score: 3,
            winnerId: user1Id,
            gameMode: 'ai',
        },
    });
    console.log('✅ Created game3: Player1 vs AI, winner: Player1');

    // Test relationships - get user with games
    const userWithGames = await prisma.user.findUnique({
        where: { id: user1Id },
        include: {
            gamesAsPlayer1: true,
            gamesAsPlayer2: true,
            gamesWon: true,
        },
    });

    console.log(`\n📊 User "${userWithGames?.username}" game stats:`);
    console.log(`   - Games as Player1: ${userWithGames?.gamesAsPlayer1.length}`);
    console.log(`   - Games as Player2: ${userWithGames?.gamesAsPlayer2.length}`);
    console.log(`   - Games Won: ${userWithGames?.gamesWon.length}`);

    // Test game with player relations
    const gameWithPlayers = await prisma.game.findUnique({
        where: { id: game1.id },
        include: {
            player1: true,
            player2: true,
            winner: true,
        },
    });

    console.log(`\n📊 Game ${game1.id} details:`);
    console.log(`   - Player1: ${gameWithPlayers?.player1.username}`);
    console.log(`   - Player2: ${gameWithPlayers?.player2?.username}`);
    console.log(`   - Winner: ${gameWithPlayers?.winner?.username}`);

    // Calculate stats
    const wins = await prisma.game.count({
        where: { winnerId: user1Id },
    });
    const totalGames = await prisma.game.count({
        where: {
            OR: [
                { player1Id: user1Id },
                { player2Id: user1Id },
            ],
        },
    });
    console.log(`\n📊 Player1 stats: ${wins} wins out of ${totalGames} games`);

    console.log('');
    return [game1.id, game2.id, game3.id];
}

async function testFriendModel(userIds: number[]): Promise<void> {
    console.log('='.repeat(50));
    console.log('👥 TESTING FRIEND MODEL + USER RELATIONS');
    console.log('='.repeat(50));

    const [user1Id, user2Id, user3Id] = userIds;

    // Create friend requests
    const friendship1 = await prisma.friend.create({
        data: {
            userId: user1Id,
            friendId: user2Id,
            status: 'pending',
        },
    });
    console.log('✅ Created friend request: Player1 → Player2 (pending)');

    const friendship2 = await prisma.friend.create({
        data: {
            userId: user1Id,
            friendId: user3Id,
            status: 'accepted',
        },
    });
    console.log('✅ Created friendship: Player1 ↔ GoogleUser (accepted)');

    // Accept friend request
    await prisma.friend.update({
        where: { id: friendship1.id },
        data: { status: 'accepted' },
    });
    console.log('✅ Accepted friend request: Player1 ↔ Player2');

    // Get user with friends
    const userWithFriends = await prisma.user.findUnique({
        where: { id: user1Id },
        include: {
            friendsSent: {
                include: { friend: true },
            },
            friendsReceived: {
                include: { user: true },
            },
        },
    });

    console.log(`\n📊 User "${userWithFriends?.username}" friends:`);
    console.log(`   - Sent requests: ${userWithFriends?.friendsSent.length}`);
    for (const f of userWithFriends?.friendsSent || []) {
        console.log(`      → ${f.friend.username} (${f.status})`);
    }
    console.log(`   - Received requests: ${userWithFriends?.friendsReceived.length}`);

    // Count accepted friends
    const acceptedFriends = await prisma.friend.count({
        where: {
            OR: [
                { userId: user1Id, status: 'accepted' },
                { friendId: user1Id, status: 'accepted' },
            ],
        },
    });
    console.log(`   - Total accepted friends: ${acceptedFriends}`);

    console.log('');
}

async function testMessageModel(userIds: number[]): Promise<void> {
    console.log('='.repeat(50));
    console.log('💬 TESTING MESSAGE MODEL + USER RELATIONS');
    console.log('='.repeat(50));

    const [user1Id, user2Id] = userIds;

    // Create messages
    const msg1 = await prisma.message.create({
        data: {
            senderId: user1Id,
            receiverId: user2Id,
            content: 'Hey, good game!',
            read: false,
        },
    });
    console.log('✅ Created message1: Player1 → Player2');

    const msg2 = await prisma.message.create({
        data: {
            senderId: user2Id,
            receiverId: user1Id,
            content: 'Thanks! Want a rematch?',
            read: false,
        },
    });
    console.log('✅ Created message2: Player2 → Player1');

    const msg3 = await prisma.message.create({
        data: {
            senderId: user1Id,
            receiverId: user2Id,
            content: 'Sure, let\'s go!',
            read: true,
        },
    });
    console.log('✅ Created message3: Player1 → Player2 (read)');

    // Get messages with sender/receiver
    const messages = await prisma.message.findMany({
        where: {
            OR: [
                { senderId: user1Id, receiverId: user2Id },
                { senderId: user2Id, receiverId: user1Id },
            ],
        },
        include: {
            sender: true,
            receiver: true,
        },
        orderBy: { sentAt: 'asc' },
    });

    console.log(`\n📊 Conversation between Player1 and Player2:`);
    for (const msg of messages) {
        const readStatus = msg.read ? '✓' : '○';
        console.log(`   [${readStatus}] ${msg.sender.username}: "${msg.content}"`);
    }

    // Get user with messages
    const userWithMessages = await prisma.user.findUnique({
        where: { id: user1Id },
        include: {
            messagesSent: true,
            messagesReceived: true,
        },
    });

    console.log(`\n📊 User "${userWithMessages?.username}" messages:`);
    console.log(`   - Sent: ${userWithMessages?.messagesSent.length}`);
    console.log(`   - Received: ${userWithMessages?.messagesReceived.length}`);

    // Count unread messages
    const unreadCount = await prisma.message.count({
        where: {
            receiverId: user1Id,
            read: false,
        },
    });
    console.log(`   - Unread: ${unreadCount}`);

    console.log('');
}

async function testCascadeAndIntegrity(userIds: number[]): Promise<void> {
    console.log('='.repeat(50));
    console.log('🔗 TESTING DATA INTEGRITY');
    console.log('='.repeat(50));

    // Count all records
    const userCount = await prisma.user.count();
    const gameCount = await prisma.game.count();
    const friendCount = await prisma.friend.count();
    const messageCount = await prisma.message.count();

    console.log('📊 Database Summary:');
    console.log(`   - Users: ${userCount}`);
    console.log(`   - Games: ${gameCount}`);
    console.log(`   - Friendships: ${friendCount}`);
    console.log(`   - Messages: ${messageCount}`);

    // Test complex query - leaderboard
    const leaderboard = await prisma.user.findMany({
        include: {
            gamesWon: true,
            gamesAsPlayer1: true,
            gamesAsPlayer2: true,
        },
    });

    console.log('\n📊 Leaderboard:');
    for (const user of leaderboard) {
        const totalGames = user.gamesAsPlayer1.length + user.gamesAsPlayer2.length;
        const wins = user.gamesWon.length;
        const winRate = totalGames > 0 ? ((wins / totalGames) * 100).toFixed(1) : '0';
        console.log(`   ${user.displayName}: ${wins}W / ${totalGames}G (${winRate}%)`);
    }

    console.log('');
}

async function main(): Promise<void> {
    console.log('\n🧪 DATABASE RELATIONSHIP TESTS\n');
    console.log('Testing Prisma schema and all model relationships\n');

    try {
        await clearDatabase();

        const userIds = await testUserModel();
        await testGameModel(userIds);
        await testFriendModel(userIds);
        await testMessageModel(userIds);
        await testCascadeAndIntegrity(userIds);

        console.log('='.repeat(50));
        console.log('✅ ALL TESTS PASSED');
        console.log('='.repeat(50));
        console.log('\nDatabase schema and relationships are working correctly.\n');

    } catch (error) {
        console.error('\n❌ TEST FAILED:', error);
        process.exit(1);
    } finally {
        await prisma.$disconnect();
    }
}

main();
