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

      console.log('Getting N-Genius access token from:', {
        apiUrl: this.apiUrl,
        outletRef: this.outletRef,
        environment: process.env.NODE_ENV
      });

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

      console.log('N-Genius auth response:', {
        status: response.status,
        hasToken: !!response.data.access_token
      });

      this.accessToken = response.data.access_token;
      return this.accessToken;
    } catch (error) {
      console.error('Error getting access token:', {
        error: error.message,
        response: error.response?.data,
        apiUrl: this.apiUrl
      });
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
      
      // Extract payment state from embedded payment object
      const payment = gatewayStatus._embedded?.payment?.[0];
      if (!payment) {
        throw new Error('No payment data found in gateway response');
      }

      const paymentState = payment.state?.toUpperCase();
      console.log('Processing payment state:', {
        state: paymentState,
        rawResponse: payment
      });

      // Define success states
      const successStates = ['CAPTURED', 'PURCHASED', 'AUTHORISED', 'AUTHORIZED'];
      const status = successStates.includes(paymentState) ? PaymentStatus.CAPTURED : PaymentStatus.FAILED;
      const errorMessage = status === PaymentStatus.FAILED ? (payment.message || 'Payment verification failed') : null;

      // Update payment record
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
        id: updatedPayment.id,
        status,
        errorMessage
      });

      // Update order status
      const orderStatus = status === PaymentStatus.CAPTURED ? OrderStatus.PROCESSING : OrderStatus.CANCELLED;
      const updatedOrder = await prisma.order.update({
        where: { id: updatedPayment.orderId },
        data: {
          status: orderStatus,
          paymentStatus: status,
          statusHistory: {
            create: {
              status: orderStatus,
              notes: status === PaymentStatus.CAPTURED 
                ? 'Payment successful' 
                : `Payment failed: ${errorMessage}`,
              updatedBy: 'SYSTEM'
            }
          }
        },
        include: {
          customer: true,
          items: true
        }
      });

      console.log('Updated order record:', {
        id: updatedOrder.id,
        status: orderStatus,
        paymentStatus: status
      });

      // Only process reward points if payment is captured
      if (status === PaymentStatus.CAPTURED) {
        try {
          // Get customer reward record
          const customerReward = await prisma.customerReward.findUnique({
            where: { customerId: updatedOrder.customer.id }
          });

          if (customerReward) {
            // Calculate points earned from this order
            const pointsEarned = calculateRewardPoints(updatedOrder.total, customerReward.points || 0);

            // Update customer's reward points
            await prisma.customerReward.update({
              where: { id: customerReward.id },
              data: {
                points: { increment: pointsEarned },
                totalPoints: { increment: pointsEarned }
              }
            });

            // Create reward history entry
            await prisma.rewardHistory.create({
              data: {
                customer: { connect: { id: updatedOrder.customer.id } },
                reward: { connect: { id: customerReward.id } },
                order: { connect: { id: updatedOrder.id } },
                pointsEarned,
                pointsRedeemed: 0,
                orderTotal: updatedOrder.total,
                action: RewardHistoryType.EARNED,
                description: `Earned ${pointsEarned} points from order #${updatedOrder.orderNumber}`
              }
            });

            console.log('Reward points processed:', {
              customerId: updatedOrder.customer.id,
              pointsEarned,
              newTotal: customerReward.points + pointsEarned
            });
          }
        } catch (rewardError) {
          console.error('Error processing reward points:', rewardError);
          // Don't throw the error, just log it
        }

        // Send confirmation email
        try {
          const { OrderEmailService } = require('./order-email.service');
          await OrderEmailService.sendOrderConfirmation(updatedOrder.id);
          console.log('Order confirmation email sent successfully');
        } catch (emailError) {
          console.error('Failed to send order confirmation email:', emailError);
          // Don't throw the error, just log it
        }
      }

      return {
        status,
        orderId: updatedOrder.id,
        orderNumber: updatedOrder.orderNumber,
        errorMessage
      };
    } catch (error) {
      console.error('Error in handleCallback:', error);
      // Add more detailed error logging
      if (error.response) {
        console.error('Response error:', error.response.data);
      }
      throw new Error(error.message || 'Failed to process payment callback');
    }
  }

  async handlePaymentCallback(reference: string): Promise<{ redirectUrl: string }> {
    try {
      console.log('Processing payment callback for reference:', reference);
      const paymentDetails = await this.getPaymentStatus(reference);
      console.log('N-Genius Payment Details:', {
        paymentState: paymentDetails.paymentState,
        authenticationState: paymentDetails.authenticationState,
        errorCode: paymentDetails.errorCode,
        errorMessage: paymentDetails.errorMessage
      });

      // Get the frontend URL from environment variables
      const baseUrl = process.env.FRONTEND_URL || 'https://pinewraps.com';

      // Check for successful payment states
      const successStates = ['CAPTURED', 'PURCHASED', 'AUTHORISED'];
      const isSuccess = successStates.includes(paymentDetails.paymentState);

      if (isSuccess) {
        console.log(`Payment marked as ${paymentDetails.paymentState}. Original state: ${paymentDetails.paymentState}`);
        
        // Update payment and order status
        await this.updatePaymentStatus(reference, paymentDetails);

        // Return success URL
        return {
          redirectUrl: `${baseUrl}/order/success`
        };
      } else {
        console.log(`Payment failed with state: ${paymentDetails.paymentState}`);
        const errorMessage = paymentDetails.errorMessage || 'Payment was not successful';
        
        // Return error URL with message
        return {
          redirectUrl: `${baseUrl}/order/error?message=${encodeURIComponent(errorMessage)}`
        };
      }
    } catch (error) {
      console.error('Error processing payment callback:', error);
      const baseUrl = process.env.FRONTEND_URL || 'https://pinewraps.com';
      return {
        redirectUrl: `${baseUrl}/order/error?message=${encodeURIComponent('An error occurred while processing your payment')}`
      };
    }
  }

  async updatePaymentStatus(reference: string, paymentDetails: any): Promise<void> {
    try {
      // First update the payment record
      const updatedPayment = await prisma.payment.update({
        where: { merchantOrderId: reference },
        data: {
          status: paymentDetails.paymentState,
          errorMessage: paymentDetails.errorMessage,
          gatewayResponse: paymentDetails,
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
      const orderStatus = paymentDetails.paymentState === 'CAPTURED' ? OrderStatus.PROCESSING : OrderStatus.CANCELLED;
      const orderUpdateData = {
        status: orderStatus,
        paymentStatus: paymentDetails.paymentState,
        statusHistory: {
          create: {
            status: orderStatus,
            notes: paymentDetails.paymentState === 'CAPTURED' 
              ? 'Payment successful' 
              : `Payment failed: ${paymentDetails.errorMessage}`,
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
    } catch (error) {
      console.error('Error updating payment status:', error);
      throw new Error('Failed to update payment status');
    }
  }

  async createPaymentOrder(order: Order & { customer: any }, platform: string = 'web'): Promise<{ paymentUrl: string }> {
    try {
      console.log('Creating payment order for:', {
        orderId: order.id,
        orderNumber: order.orderNumber,
        total: order.total,
        customerEmail: order.customer.email,
        deliveryType: order.deliveryType,
        platform
      });

      const accessToken = await this.getAccessToken();
      
      // Create payment record
      const payment = await prisma.payment.create({
        data: {
          orderId: order.id,
          amount: order.total,
          currency: paymentConfig.ngenius.currency,
          status: PaymentStatus.PENDING,
          paymentMethod: PaymentMethod.CREDIT_CARD,
          merchantOrderId: `${order.orderNumber}-${Date.now()}`,
          metadata: {
            platform,
            orderNumber: order.orderNumber,
            customerEmail: order.customer.email
          }
        }
      });

      // Use the frontend URL from environment variables
      const baseUrl = process.env.FRONTEND_URL || 'https://pinewraps.com';
      const apiUrl = process.env.API_URL || 'http://localhost:3001';

      // Create the callback URLs with platform info
      const returnUrl = `${apiUrl}/api/payments/callback?ref=${payment.merchantOrderId}&platform=${platform}`;
      const cancelUrl = `${apiUrl}/api/payments/callback?ref=${payment.merchantOrderId}&platform=${platform}&cancelled=true`;

      const payload = {
        action: "PURCHASE",
        amount: {
          currencyCode: paymentConfig.ngenius.currency,
          value: Math.round(order.total * 100)
        },
        merchantOrderReference: payment.merchantOrderId,
        merchantAttributes: {
          redirectUrl: returnUrl,
          cancelUrl: cancelUrl,
          skipConfirmationPage: true,
          skip3DS: false,
          paymentOperation: "PURCHASE",
          paymentType: "CARD",
          paymentBrand: "ALL"
        },
        billingAddress: {
          firstName: order.customer.firstName || 'Guest',
          lastName: order.customer.lastName || 'Customer',
          address1: order.shippingAddress || 'N/A',
          city: 'Dubai',
          countryCode: 'AE',
          phoneNumber: order.customer.phone || '+971500000000'
        },
        emailAddress: order.customer.email,
        language: "en"
      };

      console.log('Payment gateway request:', {
        url: `${this.apiUrl}/transactions/outlets/${this.outletRef}/orders`,
        payload: JSON.stringify(payload, null, 2)
      });

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

      if (!response.data?._links?.payment?.href) {
        console.error('Invalid payment gateway response:', response.data);
        throw new Error('Invalid response from payment gateway');
      }

      // Update payment record with gateway order ID
      await prisma.payment.update({
        where: { id: payment.id },
        data: {
          paymentOrderId: response.data.reference,
          gatewayResponse: response.data
        }
      });

      console.log('Created payment record:', {
        paymentId: payment.id,
        status: payment.status,
        merchantOrderId: payment.merchantOrderId,
        paymentOrderId: payment.paymentOrderId,
        metadata: payment.metadata
      });

      return {
        paymentUrl: response.data._links.payment.href
      };
    } catch (error) {
      console.error('Error creating payment order:', error);
      if (axios.isAxiosError(error)) {
        console.error('Payment gateway error:', {
          status: error.response?.status,
          data: error.response?.data,
          message: error.message
        });
      }
      throw new Error('Failed to create payment order');
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
