import { Request, Response } from 'express';
import { PaymentService } from '../services/payment.service';
import { PrismaClient } from '@prisma/client';
import { paymentConfig } from '../config/payment.config';

const prisma = new PrismaClient();
const frontendUrl = process.env.FRONTEND_URL || 'https://pinewraps.com';

export class PaymentController {
  static async createPayment(req: Request, res: Response) {
    try {
      const { orderId } = req.body;

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
      const result = await paymentService.createPaymentOrder(order);

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

      const paymentService = new PaymentService();
      
      // Get payment status from N-Genius
      const gatewayStatus = await paymentService.getPaymentStatus(ref);
      const payment = gatewayStatus._embedded?.payment?.[0];
      
      if (!payment) {
        console.error('No payment data found in gateway response');
        return res.redirect(`${frontendUrl}/checkout/error?message=${encodeURIComponent('Payment verification failed')}&ref=${ref}`);
      }

      const paymentState = payment.state?.toUpperCase();
      console.log('Payment State:', { state: paymentState, payment });

      // Define success states
      const successStates = ['CAPTURED', 'PURCHASED', 'AUTHORISED', 'AUTHORIZED'];
      const isSuccess = successStates.includes(paymentState);

      // Update payment status in database
      const result = await paymentService.handleCallback(ref);
      console.log('Payment processed:', result);

      if (isSuccess) {
        // Redirect to success page with order details
        return res.redirect(`${frontendUrl}/checkout/success?ref=${ref}&orderId=${result.orderId}&orderNumber=${result.orderNumber}&status=CAPTURED`);
      } else {
        // Handle failed payment
        const errorMessage = payment.message || 'Payment verification failed';
        console.log('Payment failed:', { state: paymentState, message: errorMessage });

        // Redirect to error page with details
        return res.redirect(`${frontendUrl}/checkout/error?ref=${ref}&message=${encodeURIComponent(errorMessage)}&status=FAILED`);
      }
    } catch (error) {
      console.error('Error processing payment callback:', error);
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
