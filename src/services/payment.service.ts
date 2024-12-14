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
      console.log('Getting payment status for ref:', ref);
      const accessToken = await this.getAccessToken();
      
      const response = await axios.get(
        `${this.apiUrl}/transactions/outlets/${this.outletRef}/orders/${ref}`,
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Accept': 'application/vnd.ni-payment.v2+json'
          }
        }
      );

      console.log('N-Genius payment status response:', {
        ref,
        state: response.data._embedded?.payment?.[0]?.state,
        data: response.data
      });

      return response.data;
    } catch (error) {
      console.error('Error getting payment status:', error);
      throw error;
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
      const merchantOrderRef = payment.merchantOrderReference;
      
      console.log('Processing payment:', {
        state: paymentState,
        orderRef: merchantOrderRef,
        paymentRef: payment.reference,
        orderReference: payment.orderReference
      });

      // Find payment record by merchantOrderReference
      const paymentRecord = await prisma.payment.findFirst({
        where: {
          OR: [
            { merchantOrderId: merchantOrderRef }, // Order number (e.g., ORD-2412-0038)
            { paymentOrderId: ref }, // N-Genius order reference
            { paymentReference: payment.reference } // N-Genius payment reference
          ]
        }
      });

      if (!paymentRecord) {
        console.error('Payment record not found for:', {
          merchantOrderRef,
          orderRef: ref,
          paymentRef: payment.reference
        });
        throw new Error('Payment record not found');
      }

      console.log('Found payment record:', {
        id: paymentRecord.id,
        merchantOrderId: paymentRecord.merchantOrderId,
        paymentOrderId: paymentRecord.paymentOrderId
      });

      // Define success states
      const successStates = ['CAPTURED', 'PURCHASED', 'AUTHORISED', 'AUTHORIZED'];
      const status = successStates.includes(paymentState) ? PaymentStatus.CAPTURED : PaymentStatus.FAILED;

      // Update payment record
      const updatedPayment = await prisma.payment.update({
        where: { id: paymentRecord.id },
        data: {
          status,
          paymentReference: payment.reference,
          errorMessage: status === PaymentStatus.FAILED ? (payment.message || 'Payment verification failed') : null,
          gatewayResponse: gatewayStatus,
          updatedAt: new Date(),
          paymentMethod: PaymentMethod.CREDIT_CARD
        }
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
                : `Payment failed: ${payment.message || 'Payment verification failed'}`,
              updatedBy: 'SYSTEM'
            }
          }
        },
        include: {
          customer: true,
          items: true
        }
      });

      // Send confirmation email for successful payments
      if (status === PaymentStatus.CAPTURED) {
        try {
          const { OrderEmailService } = require('./order-email.service');
          await OrderEmailService.sendOrderConfirmation(updatedOrder.id);
          console.log('Order confirmation email sent successfully');
        } catch (emailError) {
          console.error('Failed to send order confirmation email:', emailError);
        }
      }

      return {
        status,
        orderId: updatedOrder.id,
        orderNumber: updatedOrder.orderNumber,
        errorMessage: status === PaymentStatus.FAILED ? (payment.message || 'Payment verification failed') : null
      };
    } catch (error) {
      console.error('Error in handleCallback:', error);
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
        paymentState: paymentDetails._embedded?.payment?.[0]?.state,
        authenticationState: paymentDetails._embedded?.payment?.[0]?.['3ds']?.authenticationStatus,
        errorCode: paymentDetails._embedded?.payment?.[0]?.errorCode,
        errorMessage: paymentDetails._embedded?.payment?.[0]?.message
      });

      // Get the frontend URL from environment variables
      const baseUrl = process.env.FRONTEND_URL || 'https://pinewraps.com';

      // Check for successful payment states
      const successStates = ['CAPTURED', 'PURCHASED', 'AUTHORISED'];
      const isSuccess = successStates.includes(paymentDetails._embedded?.payment?.[0]?.state);

      if (isSuccess) {
        console.log(`Payment marked as ${paymentDetails._embedded?.payment?.[0]?.state}. Original state: ${paymentDetails._embedded?.payment?.[0]?.state}`);
        
        // Update payment and order status
        await this.updatePaymentStatus(reference, paymentDetails);

        // Return success URL
        return {
          redirectUrl: `${baseUrl}/order/success`
        };
      } else {
        console.log(`Payment failed with state: ${paymentDetails._embedded?.payment?.[0]?.state}`);
        const errorMessage = paymentDetails._embedded?.payment?.[0]?.message || 'Payment was not successful';
        
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
          status: paymentDetails._embedded?.payment?.[0]?.state,
          errorMessage: paymentDetails._embedded?.payment?.[0]?.message,
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
      const orderStatus = paymentDetails._embedded?.payment?.[0]?.state === 'CAPTURED' ? OrderStatus.PROCESSING : OrderStatus.CANCELLED;
      const orderUpdateData = {
        status: orderStatus,
        paymentStatus: paymentDetails._embedded?.payment?.[0]?.state,
        statusHistory: {
          create: {
            status: orderStatus,
            notes: paymentDetails._embedded?.payment?.[0]?.state === 'CAPTURED' 
              ? 'Payment successful' 
              : `Payment failed: ${paymentDetails._embedded?.payment?.[0]?.message}`,
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

  async createPaymentOrder(order: Order & { customer: any }): Promise<{ paymentUrl: string }> {
    try {
      const accessToken = await this.getAccessToken();
      const baseUrl = process.env.FRONTEND_URL || 'https://pinewraps.com';

      // Create payment record in database first
      const payment = await prisma.payment.create({
        data: {
          orderId: order.id,
          merchantOrderId: order.orderNumber, // This is what N-Genius will return as merchantOrderReference
          amount: order.total,
          currency: 'AED',
          status: PaymentStatus.PENDING,
          paymentMethod: PaymentMethod.CREDIT_CARD,
          createdAt: new Date(),
          updatedAt: new Date()
        }
      });

      console.log('Created payment record:', {
        paymentId: payment.id,
        merchantOrderId: payment.merchantOrderId,
        orderId: order.id,
        status: payment.status
      });

      // Default store address for pickup orders
      const storeAddress = {
        address1: "Jumeirah 1",
        city: "Dubai",
        countryCode: "AE",
        postcode: "12345"
      };

      // Determine billing address based on delivery type
      const billingAddress = order.deliveryType === 'DELIVERY' && order.shippingAddress
        ? {
            firstName: order.customer.firstName || 'Guest',
            lastName: order.customer.lastName || 'Customer',
            address1: order.shippingAddress.street || 'Not Provided',
            apartment: order.shippingAddress.apartment,
            city: order.shippingAddress.city || 'Dubai',
            countryCode: "AE",
            postcode: order.shippingAddress.pincode || '12345'
          }
        : {
            firstName: order.customer.firstName || 'Guest',
            lastName: order.customer.lastName || 'Customer',
            address1: storeAddress.address1,
            city: storeAddress.city,
            countryCode: storeAddress.countryCode,
            postcode: storeAddress.postcode
          };

      const payload = {
        action: "SALE",
        amount: {
          currencyCode: "AED",
          value: Math.round(order.total * 100)
        },
        merchantOrderReference: order.orderNumber,
        merchantAttributes: {
          redirectUrl: `${baseUrl}/checkout/success`,
          cancelUrl: `${baseUrl}/checkout/error`,
          skipConfirmationPage: true,
          skip3DS: false,
          paymentOperation: "PURCHASE",
          paymentType: "CARD",
          paymentBrand: "ALL"
        },
        emailAddress: order.customer.email,
        billingAddress: {
          ...billingAddress,
          phoneNumber: order.customer.phone || '+971500000000'
        },
        language: "en"
      };

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

      // Update payment record with N-Genius order ID
      if (response.data?._id) {
        await prisma.payment.update({
          where: { id: payment.id },
          data: {
            paymentOrderId: response.data._id.split(':')[2], // Extract the ID from 'urn:order:ID'
            gatewayResponse: response.data
          }
        });
      }

      return {
        paymentUrl: response.data._links?.payment?.href
      };
    } catch (error) {
      console.error('Error creating payment order:', error);
      throw error;
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
