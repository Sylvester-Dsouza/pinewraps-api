import { Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { OrderService } from '../services/order.service';
import { OrderAnalyticsService } from '../services/order-analytics.service';
import { OrderEmailService } from '../services/order-email.service';
import WebSocketService from '../services/websocket.service';
import { 
  OrderSchema, 
  OrderStatus, 
  CreateOrderSchema,
  GetOrdersQuerySchema,
  GetAnalyticsQuerySchema,
  UpdateOrderStatusSchema,
  UpdateAdminNotesSchema,
  SendEmailSchema 
} from '../models/order.model';
import { ApiError } from '../utils/api-error';
import { DeliveryType, UserRole } from '@prisma/client';

export class OrderController {
  public static initialize(wsService: WebSocketService) {
    OrderService.initialize(wsService);
  }

  static async getOrders(req: Request, res: Response) {
    try {
      console.log('User role:', req.user?.role);
      const { page = 1, limit = 10, status, search } = GetOrdersQuerySchema.parse(req.query);
      console.log('Query params:', { page, limit, status, search });
      
      const where: any = {};
      
      // Only add status filter if it's a valid OrderStatus
      if (status && status !== 'all' && Object.values(OrderStatus).includes(status as OrderStatus)) {
        where.status = status;
      }

      // Add customer filter for non-admin users
      if (req.user?.role === 'CUSTOMER') {
        where.customerId = req.user.id;
        console.log('Filtering orders for customer:', req.user.id);
      }

      const skip = (Number(page) - 1) * Number(limit);

      const [orders, total] = await Promise.all([
        prisma.order.findMany({
          where,
          skip,
          take: Number(limit),
          orderBy: { createdAt: 'desc' },
          include: {
            customer: true,
            items: true,
            payment: true,
            statusHistory: {
              orderBy: {
                updatedAt: 'desc'
              }
            }
          }
        }),
        prisma.order.count({ where })
      ]);

      return res.json({
        success: true,
        data: {
          results: orders,
          pagination: {
            total,
            page: Number(page),
            limit: Number(limit)
          }
        }
      });
    } catch (error) {
      console.error('Get orders error:', error);
      return res.status(500).json({
        success: false,
        error: {
          code: 'ORDERS_ERROR',
          message: 'Failed to get orders',
          details: error instanceof Error ? error.message : 'Unknown error'
        }
      });
    }
  }

  static async getOrder(req: Request, res: Response) {
    try {
      const { orderId } = req.params;
      
      if (!orderId) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'INVALID_ORDER_ID',
            message: 'Order ID is required'
          }
        });
      }

      const order = await prisma.order.findUnique({
        where: {
          id: orderId
        },
        include: {
          customer: true,
          items: true,
          payment: true,
          statusHistory: {
            orderBy: {
              updatedAt: 'desc'
            }
          }
        }
      });

      if (!order) {
        return res.status(404).json({
          success: false,
          error: {
            code: 'ORDER_NOT_FOUND',
            message: 'Order not found'
          }
        });
      }

      return res.json({ success: true, data: order });
    } catch (error) {
      console.error('Get order error:', error);
      return res.status(500).json({
        success: false,
        error: {
          code: 'ORDER_ERROR',
          message: 'Failed to get order details',
          details: error instanceof Error ? error.message : 'Unknown error'
        }
      });
    }
  }

  static async getOrderSnapshot(req: Request, res: Response) {
    try {
      const orderId = req.params.orderId;
      const snapshot = await OrderService.getOrderSnapshot(orderId);
      return res.json({ success: true, data: snapshot });
    } catch (error) {
      console.error('Get order snapshot error:', error);
      return res.status(500).json({
        success: false,
        error: {
          code: 'ORDER_SNAPSHOT_ERROR',
          message: 'Failed to get order snapshot',
          details: error instanceof Error ? error.message : 'Unknown error'
        }
      });
    }
  }

  static async getAnalytics(req: Request, res: Response) {
    try {
      const { timeRange } = GetAnalyticsQuerySchema.parse(req.query);
      const result = await OrderAnalyticsService.getAnalytics(timeRange);
      return res.json({ success: true, data: result });
    } catch (error) {
      console.error('Analytics error:', error);
      return res.status(500).json({
        success: false,
        error: {
          code: 'ANALYTICS_ERROR',
          message: 'Failed to get analytics',
          details: error instanceof Error ? error.message : 'Unknown error'
        }
      });
    }
  }

  static async createOrder(req: Request, res: Response) {
    try {
      const orderData = CreateOrderSchema.parse(req.body);
      const order = await OrderService.createOrder(orderData);
      return res.json({ success: true, data: order });
    } catch (error) {
      console.error('Create order error:', error);
      return res.status(500).json({
        success: false,
        error: {
          code: 'ORDER_CREATE_ERROR',
          message: 'Failed to create order',
          details: error instanceof Error ? error.message : 'Unknown error'
        }
      });
    }
  }

  static async updateOrderStatus(req: Request, res: Response) {
    try {
      const { orderId } = req.params;
      const { status } = UpdateOrderStatusSchema.parse(req.body);

      if (!orderId) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'INVALID_ORDER_ID',
            message: 'Order ID is required'
          }
        });
      }

      if (!Object.values(OrderStatus).includes(status)) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'INVALID_STATUS',
            message: 'Invalid order status'
          }
        });
      }

      const updatedBy = req.user?.email || 'ADMIN';
      const updatedOrder = await OrderService.updateOrderStatus(orderId, status as OrderStatus, updatedBy);
      
      return res.json({
        success: true,
        data: updatedOrder
      });
    } catch (error) {
      console.error('Update order status error:', error);
      return res.status(500).json({
        success: false,
        error: {
          code: 'UPDATE_STATUS_ERROR',
          message: 'Failed to update order status',
          details: error instanceof Error ? error.message : 'Unknown error'
        }
      });
    }
  }

  static async cancelOrder(req: Request, res: Response) {
    try {
      const orderId = req.params.orderId;
      const userId = req.user?.id;
      const userRole = req.user?.role;

      // Get the order first to check permissions
      const order = await prisma.order.findUnique({
        where: { id: orderId },
        include: {
          customer: true,
          items: true
        }
      });
      
      // Check if order exists
      if (!order) {
        return res.status(404).json({
          success: false,
          error: {
            code: 'ORDER_NOT_FOUND',
            message: 'Order not found'
          }
        });
      }

      // Check if user has permission to cancel the order
      const isAdmin = userRole === UserRole.ADMIN || userRole === UserRole.SUPER_ADMIN;
      if (!isAdmin && order.userId !== userId) {
        return res.status(403).json({
          success: false,
          error: {
            code: 'PERMISSION_DENIED',
            message: 'You do not have permission to cancel this order'
          }
        });
      }

      // Check if order can be cancelled (only PENDING or PENDING_PAYMENT orders can be cancelled by customers)
      if (!isAdmin && 
          order.status !== OrderStatus.PENDING && 
          order.status !== OrderStatus.PENDING_PAYMENT) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'INVALID_STATUS',
            message: 'Order cannot be cancelled in its current status'
          }
        });
      }

      const cancelledOrder = await OrderService.cancelOrder(orderId);
      return res.json({ success: true, data: cancelledOrder });
    } catch (error) {
      console.error('Cancel order error:', error);
      return res.status(500).json({
        success: false,
        error: {
          code: 'CANCEL_ERROR',
          message: 'Failed to cancel order',
          details: error instanceof Error ? error.message : 'Unknown error'
        }
      });
    }
  }

  static async updateAdminNotes(req: Request, res: Response) {
    try {
      const { adminNotes } = UpdateAdminNotesSchema.parse(req.body);
      const orderId = req.params.id;
      const order = await prisma.order.update({
        where: { id: orderId },
        data: { adminNotes }
      });
      return res.json({ success: true, data: order });
    } catch (error) {
      console.error('Update notes error:', error);
      return res.status(500).json({
        success: false,
        error: {
          code: 'NOTES_UPDATE_ERROR',
          message: 'Failed to update admin notes',
          details: error instanceof Error ? error.message : 'Unknown error'
        }
      });
    }
  }

  static async exportOrders(req: Request, res: Response) {
    try {
      const csv = await OrderService.exportOrders();
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename=orders.csv');
      return res.send(csv);
    } catch (error) {
      console.error('Export orders error:', error);
      return res.status(500).json({
        success: false,
        error: {
          code: 'EXPORT_ERROR',
          message: 'Failed to export orders',
          details: error instanceof Error ? error.message : 'Unknown error'
        }
      });
    }
  }

  static async sendEmail(req: Request, res: Response) {
    try {
      const { subject, body } = SendEmailSchema.parse(req.body);
      const orderId = req.params.id;
      await OrderEmailService.sendOrderEmail(orderId, subject, body);
      return res.json({ success: true });
    } catch (error) {
      console.error('Send email error:', error);
      return res.status(500).json({
        success: false,
        error: {
          code: 'EMAIL_ERROR',
          message: 'Failed to send email',
          details: error instanceof Error ? error.message : 'Unknown error'
        }
      });
    }
  }
}