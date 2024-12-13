import axios from 'axios';
import { prisma } from '../lib/prisma';
import { paymentConfig } from '../config/payment.config';
import { PaymentStatus, PaymentMethod, OrderStatus } from '@prisma/client';
import { Order } from '@prisma/client';

export class PaymentService {
  private apiUrl: string;
  private outletRef: string;
  private accessToken: string | null = null;

  constructor() {
    this.apiUrl = paymentConfig.ngenius.apiUrl;
    this.outletRef = paymentConfig.ngenius.outletRef;
  }

  private async getAccessToken(): Promise<string> {
    try {
      if (this.accessToken) {
        return this.accessToken;
      }

      const response = await axios.post(
        `${this.apiUrl}/identity/auth/access-token`,
        {},
        {
          headers: {
            'Authorization': `Basic ${paymentConfig.ngenius.apiKey}`,
            'Content-Type': 'application/vnd.ni-identity.v1+json'
          }
        }
      );

      this.accessToken = response.data.access_token;
      return this.accessToken;
    } catch (error) {
      console.error('Error getting access token:', error);
      throw new Error('Failed to get access token');
    }
  }

  async getPaymentStatus(ref: string): Promise<any> {
    try {
      const token = await this.getAccessToken();
      
      const response = await axios.get(
        `${this.apiUrl}/transactions/outlets/${this.outletRef}/orders/${ref}`,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/vnd.ni-payment.v2+json'
          }
        }
      );

      // Log the complete raw response for debugging
      console.log('N-Genius Raw Response:', JSON.stringify(response.data, null, 2));

      // Extract payment state and 3DS state from embedded payment object
      const payment = response.data?._embedded?.payment?.[0];
      const paymentState = payment?.state?.toUpperCase();
      const authenticationState = payment?.['3ds']?.authenticationStatus?.toUpperCase();
      
      // Log detailed payment information
      console.log('N-Genius Payment Details:', {
        paymentState,
        authenticationState,
        errorCode: payment?.errorCode,
        errorMessage: payment?.message
      });

      return {
        ...response.data,
        payment: {
          ...payment,
          state: paymentState,
          authenticationState
        }
      };
    } catch (error) {
      console.error('Error getting payment status:', error);
      if (error.response) {
        console.error('N-Genius Error Response:', error.response.data);
      }
      throw new Error('Failed to get payment status from gateway');
    }
  }

  async handleCallback(ref: string): Promise<any> {
    try {
      const gatewayStatus = await this.getPaymentStatus(ref);
      console.log('Gateway payment status:', JSON.stringify(gatewayStatus, null, 2));

      let status: PaymentStatus = 'FAILED';
      let errorMessage: string | null = null;

      // Extract payment state and 3DS state from embedded payment object
      const payment = gatewayStatus?._embedded?.payment?.[0];
      const paymentState = payment?.state?.toUpperCase();
      const authenticationState = payment?.['3ds']?.status?.toUpperCase();
      
      console.log('Complete payment object:', JSON.stringify(payment, null, 2));
      console.log('Payment state analysis:', {
        rawState: payment?.state,
        upperState: paymentState,
        auth3DS: payment?.['3ds'],
        authState: authenticationState,
        errorInfo: {
          code: payment?.errorCode,
          message: payment?.message
        }
      });

      // First check if payment is explicitly failed
      if (!paymentState || paymentState === 'FAILED' || paymentState === 'DECLINED' || paymentState === 'CANCELLED') {
        status = 'FAILED';
        errorMessage = payment?.message || `Payment ${paymentState?.toLowerCase() || 'failed'}`;
        console.log('Payment explicitly failed. State:', paymentState, 'Error:', errorMessage);
      }
      // Then check 3DS authentication state
      else if (authenticationState === 'FAILURE') {
        status = 'FAILED';
        errorMessage = payment?.['3ds']?.summaryText || '3D Secure authentication failed';
        console.log('Payment failed due to 3DS authentication failure');
      } 
      // Handle successful payments
      else if (paymentState === 'CAPTURED') {
        status = 'CAPTURED';
        console.log('Payment marked as CAPTURED. Original state:', paymentState);
      }
      // Handle authorized but not captured payments
      else if (paymentState === 'AUTHORISED' || paymentState === 'AUTHORIZED') {
        status = 'PENDING';
        console.log('Payment marked as PENDING (authorized). Original state:', paymentState);
      }
      // Any other state is considered a failure
      else {
        status = 'FAILED';
        errorMessage = payment?.message || 'Payment was not successful';
        console.log('Payment marked as FAILED. Unhandled state:', paymentState, 'Error:', errorMessage);
      }

      console.log('Final status decision:', {
        decidedStatus: status,
        errorMessage,
        originalState: paymentState,
        auth3DSState: authenticationState
      });

      // First update the payment record
      const updatedPayment = await prisma.payment.update({
        where: { merchantOrderId: ref },
        data: {
          status,
          errorMessage,
          gatewayResponse: gatewayStatus,
          updatedAt: new Date(),
          paymentMethod: PaymentMethod.CREDIT_CARD
        }
      });

      console.log('Updated payment record:', {
        paymentId: updatedPayment.id,
        status: updatedPayment.status,
        paymentMethod: updatedPayment.paymentMethod
      });

      // Then update the order status based on payment status
      const orderStatus = status === 'CAPTURED' ? OrderStatus.PROCESSING : OrderStatus.CANCELLED;
      const orderUpdateData = {
        status: orderStatus,
        paymentStatus: status,
        statusHistory: {
          create: {
            status: orderStatus,
            notes: status === 'CAPTURED' 
              ? 'Payment successful' 
              : `Payment failed: ${errorMessage}`,
            updatedBy: 'SYSTEM'
          }
        }
      };

      const updatedOrder = await prisma.order.update({
        where: { id: updatedPayment.orderId },
        data: orderUpdateData,
        include: {
          statusHistory: {
            orderBy: {
              updatedAt: 'desc'
            },
            take: 1
          }
        }
      });

      console.log('Updated order record:', {
        orderId: updatedOrder.id,
        status: updatedOrder.status,
        paymentStatus: updatedOrder.paymentStatus,
        paymentMethod: updatedOrder.paymentMethod,
        lastStatusHistory: updatedOrder.statusHistory[0]
      });

      // Send order confirmation email for successful credit card payments
      if (status === 'CAPTURED') {
        try {
          const { OrderEmailService } = await import('./order-email.service');
          await OrderEmailService.sendOrderConfirmation(updatedOrder.id);
          console.log('Order confirmation email sent after successful payment');
        } catch (error) {
          console.error('Error sending order confirmation email after payment:', error);
        }
      }

      // Return the complete updated payment record with order
      return await prisma.payment.findUnique({
        where: { id: updatedPayment.id },
        include: { order: true }
      });
    } catch (error) {
      console.error('Error handling payment callback:', error);
      throw error;
    }
  }

  async createPaymentOrder(order: Order & { customer: any }): Promise<{ paymentUrl: string }> {
    try {
      console.log('Creating payment order for:', {
        orderId: order.id,
        orderNumber: order.orderNumber,
        total: order.total,
        customerEmail: order.customer.email
      });

      const accessToken = await this.getAccessToken();
      
      // Use the ngrok URL for redirects
      const baseUrl = 'http://4e35-106-201-187-229.ngrok-free.app';

      console.log('Payment Configuration:', {
        ...paymentConfig.ngenius,
        redirectUrl: `${baseUrl}/api/payments/callback`,
        cancelUrl: `${baseUrl}/api/payments/callback?cancelled=true`
      });

      const payload = {
        action: paymentConfig.ngenius.paymentAction,
        amount: {
          currencyCode: paymentConfig.ngenius.currency,
          value: Math.round(order.total * 100)
        },
        merchantOrderReference: order.orderNumber,
        merchantAttributes: {
          redirectUrl: `${baseUrl}/api/payments/callback`,
          cancelUrl: `${baseUrl}/api/payments/callback?cancelled=true`,
          skipConfirmationPage: true,
          skip3DS: false,
          paymentOperation: "PURCHASE",
          paymentType: "CARD",
          paymentBrand: "ALL"
        },
        emailAddress: order.customer.email,
        billingAddress: {
          firstName: order.customer.firstName,
          lastName: order.customer.lastName,
          address1: order.shippingAddress?.address1 || "Not Provided",
          city: order.shippingAddress?.city || "Dubai",
          countryCode: "AE"
        },
        language: "en"
      };

      console.log('Payment payload:', JSON.stringify(payload, null, 2));

      const response = await axios.post(
        `${this.apiUrl}/transactions/outlets/${this.outletRef}/orders`,
        payload,
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/vnd.ni-payment.v2+json',
            'Accept': 'application/vnd.ni-payment.v2+json'
          }
        }
      );

      console.log('Payment gateway response:', JSON.stringify(response.data, null, 2));

      if (!response.data?._links?.payment?.href) {
        console.error('Invalid payment gateway response:', response.data);
        throw new Error('Invalid response from payment gateway');
      }

      const payment = await prisma.payment.create({
        data: {
          orderId: order.id,
          amount: order.total,
          currency: paymentConfig.ngenius.currency,
          status: PaymentStatus.PENDING,
          paymentMethod: PaymentMethod.CREDIT_CARD,
          merchantOrderId: response.data.reference,
          paymentOrderId: response.data._embedded?.payment?.[0]?.reference,
          gatewayResponse: response.data
        }
      });

      console.log('Created payment record:', {
        paymentId: payment.id,
        status: payment.status,
        merchantOrderId: payment.merchantOrderId
      });

      return {
        paymentUrl: response.data._links.payment.href
      };
    } catch (error) {
      if (axios.isAxiosError(error)) {
        console.error('Network error creating payment:', {
          status: error.response?.status,
          data: error.response?.data,
          message: error.message,
          errors: error.response?.data?.errors // Log detailed validation errors
        });
        throw new Error(`Payment gateway error: ${error.response?.data?.message || error.message}`);
      }
      console.error('Error creating payment order:', error);
      throw new Error('Failed to create payment order: ' + error.message);
    }
  }

  static async handlePaymentCallback(reference: string): Promise<void> {
    try {
      const paymentService = new PaymentService();
      await paymentService.handleCallback(reference);
    } catch (error) {
      console.error('Error handling payment callback:', error);
      throw new Error('Failed to handle payment callback');
    }
  }

  static async refundPayment(
    paymentId: string,
    amount?: number,
    reason?: string
  ): Promise<void> {
    try {
      const payment = await prisma.payment.findUnique({
        where: { id: paymentId },
        include: {
          order: true
        }
      });

      if (!payment) {
        throw new Error('Payment not found');
      }

      const accessToken = await this.getAccessToken();

      // Create refund request
      const response = await axios.post(
        `${paymentConfig.ngenius.apiUrl}/transactions/outlets/${paymentConfig.ngenius.outletRef}/orders/${payment.merchantOrderId}/refund`,
        {
          amount: {
            currencyCode: payment.currency,
            value: Math.round((amount || payment.amount) * 100)
          }
        },
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/vnd.ni-payment.v2+json'
          }
        }
      );

      // Update payment record
      await prisma.payment.update({
        where: { id: payment.id },
        data: {
          status: PaymentStatus.REFUNDED,
          refundAmount: amount || payment.amount,
          refundReason: reason,
          gatewayResponse: {
            ...payment.gatewayResponse,
            refund: response.data
          }
        }
      });

      // Update order status
      await prisma.order.update({
        where: { id: payment.orderId },
        data: {
          paymentStatus: PaymentStatus.REFUNDED,
          status: OrderStatus.REFUNDED
        }
      });
    } catch (error) {
      console.error('Error refunding payment:', error);
      throw new Error('Failed to refund payment');
    }
  }
}
