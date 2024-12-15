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

      const payment = response.data?._embedded?.payment?.[0];
      const paymentState = payment?.state?.toUpperCase();
      const authenticationState = payment?.['3ds']?.authenticationStatus?.toUpperCase();
      
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

  async processPaymentCallback(reference: string): Promise<{ success: boolean; message?: string }> {
    try {
      const paymentDetails = await this.getPaymentStatus(reference);
      const paymentState = paymentDetails.payment?.state;
      
      console.log('Processing payment callback:', {
        reference,
        state: paymentState,
        details: paymentDetails
      });

      // Find the payment record
      const payment = await prisma.payment.findFirst({
        where: { merchantOrderId: reference },
        include: { order: true }
      });

      if (!payment) {
        console.error('Payment not found for reference:', reference);
        return { success: false, message: 'Payment not found' };
      }

      // Update payment status based on N-Genius response
      let status = PaymentStatus.PENDING;
      let orderStatus = payment.order.status;

      if (paymentState === 'CAPTURED' || paymentState === 'PURCHASED') {
        status = PaymentStatus.PAID;
        orderStatus = OrderStatus.CONFIRMED;
      } else if (paymentState === 'FAILED' || paymentState === 'DECLINED') {
        status = PaymentStatus.FAILED;
        orderStatus = OrderStatus.PAYMENT_FAILED;
      } else if (paymentState === 'CANCELLED') {
        status = PaymentStatus.CANCELLED;
        orderStatus = OrderStatus.CANCELLED;
      }

      // Update payment record
      await prisma.payment.update({
        where: { id: payment.id },
        data: {
          status,
          gatewayResponse: paymentDetails
        }
      });

      // Update order status
      await prisma.order.update({
        where: { id: payment.orderId },
        data: {
          status: orderStatus,
          paymentStatus: status
        }
      });

      console.log('Payment processed successfully:', {
        status,
        orderId: payment.orderId,
        orderNumber: payment.order.orderNumber,
        errorMessage: paymentDetails.payment?.message || null
      });

      return {
        success: status === PaymentStatus.PAID,
        message: paymentDetails.payment?.message
      };
    } catch (error) {
      console.error('Error processing payment callback:', error);
      return { success: false, message: 'Error processing payment' };
    }
  }

  async createPaymentOrder(order: Order & { customer: any }, platform: 'web' | 'mobile' = 'web'): Promise<{ paymentUrl: string }> {
    try {
      const accessToken = await this.getAccessToken();

      const redirectUrl = platform === 'mobile' 
        ? paymentConfig.ngenius.mobile.redirectUrl 
        : paymentConfig.ngenius.web.redirectUrl;
      
      const cancelUrl = platform === 'mobile'
        ? paymentConfig.ngenius.mobile.cancelUrl
        : paymentConfig.ngenius.web.cancelUrl;

      const billingAddress = {
        firstName: order.customer.firstName,
        lastName: order.customer.lastName,
        address1: order.streetAddress,
        city: order.city,
        countryCode: 'AE'
      };

      console.log('Creating payment order:', {
        orderId: order.id,
        orderNumber: order.orderNumber,
        total: order.total,
        redirectUrl,
        cancelUrl,
        platform
      });

      const payload = {
        action: paymentConfig.ngenius.paymentAction,
        amount: {
          currencyCode: paymentConfig.ngenius.currency,
          value: Math.round(order.total * 100)
        },
        merchantOrderReference: order.orderNumber,
        merchantAttributes: {
          redirectUrl,
          cancelUrl,
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
        merchantOrderId: payment.merchantOrderId,
        paymentOrderId: payment.paymentOrderId
      });

      return {
        paymentUrl: response.data._links.payment.href
      };
    } catch (error) {
      if (axios.isAxiosError(error)) {
        console.error('N-Genius API Error:', {
          status: error.response?.status,
          data: error.response?.data,
          message: error.message,
          errors: error.response?.data?.errors
        });
        throw new Error(`Payment gateway error: ${error.response?.data?.message || error.message}`);
      }
      console.error('Error creating payment order:', error);
      throw new Error('Failed to create payment order: ' + error.message);
    }
  }
}
