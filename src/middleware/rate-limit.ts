import rateLimit from 'express-rate-limit';
import { prisma } from '../lib/prisma';
import { Store } from 'express-rate-limit';

// Create a store for rate limiting using Prisma
const PrismaStore: Store = {
  async increment(key: string): Promise<void> {
    await prisma.rateLimitStore.upsert({
      where: { key },
      create: {
        key,
        points: 1,
        expire: new Date(Date.now() + 60 * 1000) // 1 minute expiry
      },
      update: {
        points: { increment: 1 }
      }
    });
  },

  async decrement(key: string): Promise<void> {
    await prisma.rateLimitStore.update({
      where: { key },
      data: {
        points: { decrement: 1 }
      }
    });
  },

  async resetKey(key: string): Promise<void> {
    await prisma.rateLimitStore.delete({
      where: { key }
    });
  },

  async getPoints(key: string): Promise<number> {
    const record = await prisma.rateLimitStore.findUnique({
      where: { key }
    });

    // Clean up expired records
    if (record && record.expire < new Date()) {
      await prisma.rateLimitStore.delete({
        where: { key }
      });
      return 0;
    }

    return record?.points || 0;
  }
};

// General API rate limit
export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later',
  store: PrismaStore
});

// Login rate limit
export const loginLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5, // Limit each IP to 5 login requests per hour
  message: 'Too many login attempts from this IP, please try again later',
  store: PrismaStore
});
