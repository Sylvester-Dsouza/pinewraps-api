import { Request, Response } from 'express';
import { PaymentService } from '../services/payment.service';
import { PrismaClient, PaymentStatus } from '@prisma/client';
import { paymentConfig } from '../config/payment.config';

const prisma = new PrismaClient();
const frontendUrl = process.env.FRONTEND_URL || 'https://pinewraps.com';

export class PaymentController {
  static async createPayment(req: Request, res: Response) {
    try {
      const { orderId } = req.body;
      const userId = req.user?.id;

      console.log('Creating payment for order:', {
        orderId,
        userId,
        userAgent: req.headers['user-agent'],
        platform: req.headers['x-platform'] || 'web'
      });

      // Get the order with customer details
      const order = await prisma.order.findUnique({
        where: { id: orderId },
        include: {
          customer: true,
          items: true
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

      // Check if user has permission to create payment for this order
      if (order.customer?.id !== userId) {
        return res.status(403).json({
          success: false,
          error: {
            code: 'PERMISSION_DENIED',
            message: 'You do not have permission to create payment for this order'
          }
        });
      }

      // Add platform info to customer object
      const enrichedOrder = {
        ...order,
        customer: {
          ...order.customer,
          platform: req.headers['x-platform'] || 'web'
        }
      };

      const paymentService = new PaymentService();
      const result = await paymentService.createPaymentOrder(enrichedOrder);

      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      console.error('Payment creation error:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'PAYMENT_CREATION_ERROR',
          message: error instanceof Error ? error.message : 'Failed to create payment',
          details: error instanceof Error ? error.stack : undefined
        }
      });
    }
  }

  static async handleCallback(req: Request, res: Response) {
    try {
      const { ref } = req.query;

      console.log('=== PAYMENT CALLBACK START ===');
      console.log('Callback Query Parameters:', req.query);

      if (!ref || typeof ref !== 'string') {
        console.error('Payment callback received without reference');
        return res.redirect(`${frontendUrl}/checkout/error?message=${encodeURIComponent('Payment reference is missing')}`);
      }

      // If payment was cancelled by user
      if (req.query.cancelled === 'true') {
        console.log('Payment was cancelled by user');
        return res.redirect(`${frontendUrl}/checkout/error?message=${encodeURIComponent('Payment was cancelled')}&ref=${ref}&status=CANCELLED`);
      }

      const paymentService = new PaymentService();
      
      try {
        // Get payment details to check if it's an app payment
        const payment = await prisma.payment.findFirst({
          where: {
            OR: [
              { merchantOrderId: ref },
              { paymentOrderId: ref }
            ]
          }
        });

        if (!payment) {
          throw new Error('Payment not found');
        }

        // Process payment and get result
        const result = await paymentService.handleCallback(ref);
        console.log('Payment processed successfully:', result);

        // Determine redirect URL based on whether it's an app or web payment
        if (result.status === PaymentStatus.CAPTURED) {
          if (payment.isApp) {
            // For app payments, redirect to app deep link
            return res.redirect(`pinewraps://payment/success?orderId=${payment.orderId}`);
          } else {
            // For web payments, redirect to web success page
            return res.redirect(`${frontendUrl}/checkout/success?orderId=${payment.orderId}`);
          }
        } else {
          // Handle failed payment
          const errorMessage = result.errorMessage || 'Payment verification failed';
          if (payment.isApp) {
            return res.redirect(`pinewraps://payment/error?orderId=${payment.orderId}&message=${encodeURIComponent(errorMessage)}`);
          } else {
            return res.redirect(`${frontendUrl}/checkout/error?message=${encodeURIComponent(errorMessage)}&ref=${ref}&status=FAILED`);
          }
        }
      } catch (error) {
        console.error('Error processing payment:', error);
        const errorMessage = error.message || 'An error occurred while processing payment';
        
        // Try to get payment details for app check
        try {
          const payment = await prisma.payment.findFirst({
            where: {
              OR: [
                { merchantOrderId: ref },
                { paymentOrderId: ref }
              ]
            }
          });

          if (payment?.isApp) {
            return res.redirect(`pinewraps://payment/error?orderId=${payment.orderId}&message=${encodeURIComponent(errorMessage)}`);
          }
        } catch (e) {
          console.error('Error getting payment details:', e);
        }

        return res.redirect(`${frontendUrl}/checkout/error?message=${encodeURIComponent(errorMessage)}&ref=${ref}`);
      }
    } catch (error) {
      console.error('Error in payment callback:', error);
      // Always redirect to error page, never show 500
      return res.redirect(`${frontendUrl}/checkout/error?message=${encodeURIComponent('An error occurred while processing payment')}`);
    }
  }

  static async getPaymentStatus(req: Request, res: Response) {
    try {
      const { ref } = req.params;

      if (!ref) {
        return res.status(400).json({ error: 'Payment reference is required' });
      }

      // Get payment details from database
      const payment = await prisma.payment.findFirst({
        where: {
          OR: [
            { merchantOrderId: ref },
            { paymentOrderId: ref }
          ]
        },
        include: {
          order: true
        }
      });

      if (!payment) {
        return res.status(404).json({ error: 'Payment not found' });
      }

      // Get latest status from payment gateway
      const paymentService = new PaymentService();
      const gatewayStatus = await paymentService.getPaymentStatus(ref);

      console.log('Payment gateway status:', gatewayStatus);
      console.log('Database payment status:', payment.status);

      // Return payment details
      res.json({ 
        status: payment.status,
        gatewayStatus,
        orderId: payment.orderId,
        orderNumber: payment.order?.orderNumber,
        amount: payment.amount,
        currency: payment.currency,
        errorMessage: payment.errorMessage
      });
    } catch (error) {
      console.error('Error in getPaymentStatus:', error);
      res.status(500).json({ error: 'Failed to get payment status' });
    }
  }

  static async refundPayment(req: Request, res: Response) {
    try {
      const { paymentId, amount, reason } = req.body;

      if (!paymentId) {
        return res.status(400).json({ error: 'Payment ID is required' });
      }

      await PaymentService.refundPayment(paymentId, amount, reason);
      res.json({ message: 'Payment refunded successfully' });
    } catch (error) {
      console.error('Error in refundPayment:', error);
      res.status(500).json({ error: 'Failed to refund payment' });
    }
  }
}
