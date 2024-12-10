import { Request, Response } from 'express';
import { PaymentService } from '../services/payment.service';
import { PrismaClient } from '@prisma/client';
import { paymentConfig } from '../config/payment.config';

const prisma = new PrismaClient();

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
      const { ref, cancelled } = req.query;

      console.log('=== PAYMENT CALLBACK START ===');
      console.log('Callback Query Parameters:', req.query);
      console.log('Callback Headers:', req.headers);
      console.log('Callback Body:', req.body);

      if (!ref || typeof ref !== 'string') {
        console.error('Payment callback received without reference');
        console.log('Redirecting to error URL due to missing reference');
        console.log('=== PAYMENT CALLBACK END ===');
        return res.redirect(`http://4e35-106-201-187-229.ngrok-free.app/checkout/error?message=${encodeURIComponent('Payment reference is missing')}`);
      }

      // If payment was cancelled by user
      if (cancelled === 'true') {
        console.log('Payment was cancelled by user');
        const errorUrl = new URL('/checkout/error', 'http://4e35-106-201-187-229.ngrok-free.app');
        errorUrl.searchParams.set('ref', ref);
        errorUrl.searchParams.set('message', 'Payment was cancelled');
        errorUrl.searchParams.set('status', 'CANCELLED');
        console.log('Redirecting to error URL due to cancellation:', errorUrl.toString());
        console.log('=== PAYMENT CALLBACK END ===');
        return res.redirect(errorUrl.toString());
      }

      console.log('Processing payment callback for reference:', ref);
      
      // First, get the current payment status from the gateway
      const paymentService = new PaymentService();
      
      console.log('Fetching payment status from N-Genius...');
      const gatewayStatus = await paymentService.getPaymentStatus(ref);
      console.log('N-Genius Raw Response:', JSON.stringify(gatewayStatus, null, 2));

      // Process the callback and update payment status
      console.log('Processing payment callback...');
      const payment = await paymentService.handleCallback(ref);
      
      console.log('Payment processing result:', {
        status: payment?.status,
        orderId: payment?.orderId,
        paymentMethod: payment?.paymentMethod,
        errorMessage: payment?.errorMessage
      });
      
      // Double verify the payment was updated correctly
      console.log('Performing final verification...');
      const updatedPayment = await prisma.payment.findFirst({
        where: { merchantOrderId: ref },
        include: { 
          order: {
            include: {
              statusHistory: {
                orderBy: {
                  updatedAt: 'desc'
                },
                take: 1
              }
            }
          }
        }
      });
      
      console.log('Final database state:', {
        paymentStatus: updatedPayment?.status,
        orderStatus: updatedPayment?.order?.status,
        paymentMethod: updatedPayment?.paymentMethod,
        errorMessage: updatedPayment?.errorMessage,
        lastStatusHistory: updatedPayment?.order?.statusHistory[0]
      });
      
      console.log('Determining redirect URL...');
      // Always redirect to error page for failed or pending payments
      if (updatedPayment?.status !== 'CAPTURED' || updatedPayment?.order?.status !== 'PROCESSING') {
        const errorUrl = new URL('/checkout/error', 'http://4e35-106-201-187-229.ngrok-free.app');
        errorUrl.searchParams.set('ref', ref.toString());
        errorUrl.searchParams.set('message', updatedPayment?.errorMessage || 'Payment was not successful');
        errorUrl.searchParams.set('status', updatedPayment?.status || 'UNKNOWN');
        if (updatedPayment?.orderId) {
          errorUrl.searchParams.set('orderId', updatedPayment.orderId);
        }
        
        console.log('Redirecting to error URL:', errorUrl.toString());
        console.log('=== PAYMENT CALLBACK END ===');
        return res.redirect(errorUrl.toString());
      }

      // Only redirect to success page if payment is captured and order is processing
      const successUrl = new URL('/checkout/success', 'http://4e35-106-201-187-229.ngrok-free.app');
      successUrl.searchParams.set('orderId', updatedPayment.orderId);
      successUrl.searchParams.set('ref', ref.toString());
      
      console.log('Redirecting to success URL:', successUrl.toString());
      console.log('=== PAYMENT CALLBACK END ===');
      res.redirect(successUrl.toString());
    } catch (error) {
      console.error('=== PAYMENT CALLBACK ERROR ===');
      console.error('Error in handleCallback:', error);
      if (error.response) {
        console.error('Error Response:', error.response.data);
      }
      const errorMessage = error instanceof Error ? error.message : 'Payment processing failed';
      console.log('Redirecting to error URL due to exception');
      console.log('=== PAYMENT CALLBACK END ===');
      res.redirect(`http://4e35-106-201-187-229.ngrok-free.app/checkout/error?message=${encodeURIComponent(errorMessage)}`);
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
