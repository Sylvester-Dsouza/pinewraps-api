import { Request, Response } from 'express';
import { PaymentService } from '../services/payment.service';
import { PrismaClient, PaymentStatus } from '@prisma/client';
import { paymentConfig } from '../config/payment.config';

const prisma = new PrismaClient();
const frontendUrl = process.env.FRONTEND_URL || 'https://pinewraps.com';

export class PaymentController {
  static async createPayment(req: Request, res: Response) {
    try {
      const { orderId, platform = 'web' } = req.body;

      // Validate platform
      if (platform !== 'web' && platform !== 'mobile') {
        return res.status(400).json({ message: 'Invalid platform. Must be either "web" or "mobile"' });
      }

      // Get the order from database
      const order = await prisma.order.findUnique({
        where: { id: orderId },
        include: {
          customer: true
        }
      });

      if (!order) {
        return res.status(404).json({ message: 'Order not found' });
      }

      // Create payment order with N-Genius
      const paymentService = new PaymentService();
      const result = await paymentService.createPaymentOrder(order, platform);

      res.json(result);
    } catch (error) {
      console.error('Error in createPayment:', error);
      res.status(500).json({ message: error.message });
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
        // Process payment and get result
        const result = await paymentService.handleCallback(ref);
        console.log('Payment processed successfully:', result);

        if (result.status === PaymentStatus.CAPTURED) {
          // Redirect to success page with order details
          const successRedirect = `${frontendUrl}/checkout/success?ref=${encodeURIComponent(ref)}&orderId=${encodeURIComponent(result.orderId)}&orderNumber=${encodeURIComponent(result.orderNumber)}`;
          return res.redirect(successRedirect);
        } else {
          // Handle failed payment
          const errorRedirect = `${frontendUrl}/checkout/error?ref=${encodeURIComponent(ref)}&message=${encodeURIComponent(result.errorMessage || 'Payment verification failed')}&status=FAILED`;
          return res.redirect(errorRedirect);
        }
      } catch (error) {
        console.error('Error processing payment:', error);
        const errorMessage = error.message || 'An error occurred while processing payment';
        return res.redirect(`${frontendUrl}/checkout/error?message=${encodeURIComponent(errorMessage)}&ref=${ref}`);
      }
    } catch (error) {
      console.error('Error in payment callback:', error);
      // Always redirect to error page, never show 500
      return res.redirect(`${frontendUrl}/checkout/error?message=${encodeURIComponent('An error occurred while processing payment')}`);
    }
  }

  static async handleMobileCallback(req: Request, res: Response) {
    try {
      const { ref, cancelled } = req.query;

      console.log('=== MOBILE PAYMENT CALLBACK START ===');
      console.log('Mobile Callback Query Parameters:', req.query);

      if (!ref || typeof ref !== 'string') {
        console.error('Mobile payment callback received without reference');
        return res.status(400).json({ 
          success: false, 
          error: 'Payment reference is missing' 
        });
      }

      if (cancelled === 'true') {
        console.log('Payment was cancelled by user');
        return res.status(200).json({ 
          success: false, 
          error: 'Payment was cancelled',
          status: 'CANCELLED'
        });
      }

      const paymentService = new PaymentService();
      
      try {
        // Process payment and get result - this updates payment and order status
        const result = await paymentService.handleCallback(ref);
        console.log('Payment processed successfully:', result);

        return res.status(200).json({
          success: true,
          data: {
            status: result.status,
            orderId: result.orderId,
            orderNumber: result.orderNumber,
            errorMessage: result.errorMessage
          }
        });
      } catch (error) {
        console.error('Error processing mobile payment:', error);
        const errorMessage = error.message || 'An error occurred while processing payment';
        return res.status(500).json({ 
          success: false, 
          error: errorMessage 
        });
      }
    } catch (error) {
      console.error('Error in mobile payment callback:', error);
      return res.status(500).json({ 
        success: false, 
        error: 'An error occurred while processing payment' 
      });
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

  static async getMobilePaymentStatus(req: Request, res: Response) {
    try {
      const { ref } = req.params;

      if (!ref) {
        return res.status(400).json({ success: false, error: 'Payment reference is required' });
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
        return res.status(404).json({ success: false, error: 'Payment not found' });
      }

      // Format response specifically for mobile
      return res.json({
        success: true,
        data: {
          status: payment.status,
          orderId: payment.order?.id,
          orderNumber: payment.order?.orderNumber,
          amount: payment.amount,
          currency: payment.currency,
          createdAt: payment.createdAt,
          updatedAt: payment.updatedAt
        }
      });
    } catch (error) {
      console.error('Error getting mobile payment status:', error);
      return res.status(500).json({ 
        success: false, 
        error: 'Failed to get payment status'
      });
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
