import { createClient, RedisClientType } from 'redis';

let redisClient: RedisClientType | null = null;

export async function getRedisClient(): Promise<RedisClientType> {
    if (!redisClient) {
        redisClient = createClient({
            url: process.env.REDIS_URL || 'redis://redis:6379',
        });

        redisClient.on('error', (err) => console.error('Redis error:', err));
        await redisClient.connect();
    }
    return redisClient;
}

export async function publishEvent(channel: string, data: object): Promise<void> {
    const client = await getRedisClient();
    await client.publish(channel, JSON.stringify(data));
}

export async function subscribeToChannel(
    channel: string,
    callback: (message: string) => void
): Promise<void> {
    const subscriber = (await getRedisClient()).duplicate();
    await subscriber.connect();
    await subscriber.subscribe(channel, callback);
}

export default { getRedisClient, publishEvent, subscribeToChannel };
