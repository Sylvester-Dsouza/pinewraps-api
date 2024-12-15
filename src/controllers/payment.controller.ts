import { Request, Response } from 'express';
import { PaymentService } from '../services/payment.service';
import { PrismaClient, PaymentStatus } from '@prisma/client';
import { paymentConfig } from '../config/payment.config';

const prisma = new PrismaClient();
const frontendUrl = process.env.FRONTEND_URL || 'https://pinewraps.com';
const appScheme = 'pinewraps';

export class PaymentController {
  static async createPayment(req: Request, res: Response) {
    try {
      const { orderId, platform = 'web' } = req.body;

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
      const { ref, platform } = req.query;

      console.log('=== PAYMENT CALLBACK START ===');
      console.log('Callback Query Parameters:', req.query);

      if (!ref || typeof ref !== 'string') {
        console.error('Payment callback received without reference');
        return res.redirect(`${frontendUrl}/checkout/error?message=${encodeURIComponent('Payment reference is missing')}`);
      }

      // Get the payment to check the platform
      const payment = await prisma.payment.findFirst({
        where: { merchantOrderId: ref },
        include: { order: true }
      });

      // Get platform from metadata
      const isApp = platform === 'app' || payment?.metadata?.platform === 'app';

      // If payment was cancelled by user
      if (req.query.cancelled === 'true') {
        console.log('Payment was cancelled by user');
        if (isApp) {
          return res.redirect(`${appScheme}://payment/cancel?orderId=${payment.orderId}`);
        }
        return res.redirect(`${frontendUrl}/checkout/error?message=${encodeURIComponent('Payment was cancelled')}&ref=${ref}&status=CANCELLED`);
      }

      const paymentService = new PaymentService();
      
      try {
        // Process payment and get result
        const result = await paymentService.handleCallback(ref);
        console.log('Payment processed successfully:', result);

        if (result.status === PaymentStatus.CAPTURED) {
          if (isApp) {
            return res.redirect(`${appScheme}://payment/success?orderId=${result.orderId}`);
          }
          // Redirect to website success page
          const successRedirect = `${frontendUrl}/checkout/success?ref=${encodeURIComponent(ref)}&orderId=${encodeURIComponent(result.orderId)}&orderNumber=${encodeURIComponent(result.orderNumber)}`;
          return res.redirect(successRedirect);
        } else {
          // Handle failed payment
          if (isApp) {
            return res.redirect(`${appScheme}://payment/failed?orderId=${result.orderId}`);
          }
          const errorRedirect = `${frontendUrl}/checkout/error?ref=${encodeURIComponent(ref)}&message=${encodeURIComponent(result.errorMessage || 'Payment verification failed')}&status=FAILED`;
          return res.redirect(errorRedirect);
        }
      } catch (error) {
        console.error('Error processing payment:', error);
        const errorMessage = error.message || 'An error occurred while processing payment';
        if (isApp) {
          return res.redirect(`${appScheme}://payment/failed?orderId=${payment?.orderId}`);
        }
        return res.redirect(`${frontendUrl}/checkout/error?message=${encodeURIComponent(errorMessage)}&ref=${ref}`);
      }
    } catch (error) {
      console.error('Error in payment callback:', error);
      return res.redirect(`${frontendUrl}/checkout/error?message=${encodeURIComponent('An error occurred while processing payment')}`);
    }
  }

  static async getPaymentStatus(req: Request, res: Response) {
    try {
      const { ref } = req.params;

      if (!ref) {
        return res.status(400).json({ error: 'Payment reference is required' });
      }

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

      res.json(payment);
    } catch (error) {
      console.error('Error getting payment status:', error);
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
