import { prisma } from '../lib/prisma';
import { OrderStatus } from '../models/order.model';

export class OrderAnalyticsService {
  static async getAnalytics(timeRange: '7d' | '14d' | '30d' | '3m' | 'all') {
    const { startDate, previousStartDate } = this.calculateDateRanges(timeRange);
    const now = new Date();

    const [
      orders,
      customers,
      revenue,
      previousRevenue,
      pendingOrders,
      processingOrders,
      completedOrders
    ] = await Promise.all([
      this.getTotalOrders(startDate, now),
      this.getUniqueCustomers(startDate, now),
      this.getTotalRevenue(startDate, now),
      this.getTotalRevenue(previousStartDate, startDate),
      this.getOrdersByStatus(startDate, now, OrderStatus.PENDING),
      this.getOrdersByStatus(startDate, now, OrderStatus.PROCESSING),
      this.getOrdersByStatus(startDate, now, OrderStatus.COMPLETED)
    ]);

    return {
      totalOrders: orders,
      totalCustomers: customers.length,
      totalRevenue: revenue._sum.total || 0,
      monthlyGrowth: this.calculateGrowth(revenue._sum.total, previousRevenue._sum.total),
      pendingOrders,
      processingOrders,
      completedOrders
    };
  }

  private static calculateDateRanges(timeRange: string) {
    const now = new Date();
    let startDate = new Date();
    let previousStartDate = new Date();

    switch (timeRange) {
      case '7d':
        startDate.setDate(now.getDate() - 7);
        previousStartDate.setDate(startDate.getDate() - 7);
        break;
      case '14d':
        startDate.setDate(now.getDate() - 14);
        previousStartDate.setDate(startDate.getDate() - 14);
        break;
      case '30d':
        startDate.setDate(now.getDate() - 30);
        previousStartDate.setDate(startDate.getDate() - 30);
        break;
      case '3m':
        startDate.setMonth(now.getMonth() - 3);
        previousStartDate.setMonth(startDate.getMonth() - 3);
        break;
      case 'all':
        startDate = new Date(0);
        previousStartDate = new Date(0);
        break;
    }

    return { startDate, previousStartDate };
  }

  private static async getTotalOrders(startDate: Date, endDate: Date) {
    return prisma.order.count({
      where: {
        createdAt: {
          gte: startDate,
          lte: endDate
        }
      }
    });
  }

  private static async getUniqueCustomers(startDate: Date, endDate: Date) {
    return prisma.order.findMany({
      where: {
        createdAt: {
          gte: startDate,
          lte: endDate
        }
      },
      select: {
        customerId: true
      },
      distinct: ['customerId']
    });
  }

  private static async getTotalRevenue(startDate: Date, endDate: Date) {
    return prisma.order.aggregate({
      where: {
        createdAt: {
          gte: startDate,
          lte: endDate
        },
        status: {
          not: OrderStatus.CANCELLED
        }
      },
      _sum: {
        total: true
      }
    });
  }

  private static async getOrdersByStatus(startDate: Date, endDate: Date, status: OrderStatus) {
    return prisma.order.count({
      where: {
        createdAt: {
          gte: startDate,
          lte: endDate
        },
        status
      }
    });
  }
// Calculate monthly growth
  private static calculateGrowth(current: number | null, previous: number | null): number {
    if (!current || !previous || previous === 0) return 0;
    return ((current - previous) / previous) * 100;
  }
}
