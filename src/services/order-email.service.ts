import { prisma } from '../lib/prisma';
import { Order, OrderItem, Customer } from '@prisma/client';

// Using require for Brevo SDK //
const SibApi = require('@sendinblue/client');

interface OrderWithDetails extends Order {
  customer: Customer;
  items: OrderItem[];
}

export class OrderEmailService {
  private static apiInstance: any;

  static {
    const apiKey = process.env.BREVO_API_KEY || '';
    const apiInstance = new SibApi.TransactionalEmailsApi();
    apiInstance.setApiKey(SibApi.TransactionalEmailsApiApiKeys.apiKey, apiKey);
    this.apiInstance = apiInstance;
  }

  private static async sendEmail(params: {
    to: { email: string; name: string };
    templateId: number;
    params: Record<string, any>;
    subject: string;
  }) {
    const sendSmtpEmail = new SibApi.SendSmtpEmail();
    
    sendSmtpEmail.to = [params.to];
    sendSmtpEmail.templateId = params.templateId;
    sendSmtpEmail.params = params.params;
    sendSmtpEmail.subject = params.subject;

    try {
      const result = await this.apiInstance.sendTransacEmail(sendSmtpEmail);
      console.log('Email sent successfully:', result);
      return result;
    } catch (error) {
      console.error('Error sending email:', error);
      throw error;
    }
  }

  static async sendOrderConfirmation(orderId: string) {
    const order = await this.getOrderWithDetails(orderId);
    
    return this.sendEmail({
      to: { 
        email: order.customer.email, 
        name: `${order.customer.firstName} ${order.customer.lastName}` 
      },
      templateId: Number(process.env.BREVO_ORDER_CONFIRMATION_TEMPLATE_ID),
      params: {
        order_number: order.orderNumber,
        order_date: new Date(order.createdAt).toLocaleDateString(),
        customer_name: `${order.customer.firstName} ${order.customer.lastName}`,
        order_total: order.total.toFixed(2),
        items: order.items.map(item => ({
          name: item.name,
          quantity: item.quantity,
          price: item.price.toFixed(2),
          variations: this.formatVariations(item.variations)
        })),
        delivery_method: order.deliveryMethod,
        pickup_date: order.pickupDate ? new Date(order.pickupDate).toLocaleDateString() : null,
        pickup_time: order.pickupTimeSlot,
        delivery_date: order.deliveryDate ? new Date(order.deliveryDate).toLocaleDateString() : null,
        delivery_time: order.deliveryTimeSlot,
        shipping_address: order.deliveryMethod === 'DELIVERY' ? {
          address: order.streetAddress,
          apartment: order.apartment,
          city: order.city,
          emirate: order.emirate,
          pincode: order.pincode
        } : null,
        payment_method: order.paymentMethod,
        subtotal: order.subtotal.toFixed(2),
        shipping_cost: order.deliveryCharge.toFixed(2),
        total: order.total.toFixed(2)
      },
      subject: `Order Confirmation - ${order.orderNumber}`
    });
  }

  static async sendOrderStatusUpdate(orderId: string, newStatus: string) {
    const order = await this.getOrderWithDetails(orderId);
    
    return this.sendEmail({
      to: { 
        email: order.customer.email, 
        name: `${order.customer.firstName} ${order.customer.lastName}` 
      },
      templateId: Number(process.env.BREVO_ORDER_STATUS_TEMPLATE_ID),
      params: {
        order_number: order.orderNumber,
        customer_name: `${order.customer.firstName} ${order.customer.lastName}`,
        order_status: newStatus,
        order_date: new Date(order.createdAt).toLocaleDateString(),
        delivery_method: order.deliveryMethod,
        pickup_date: order.pickupDate ? new Date(order.pickupDate).toLocaleDateString() : null,
        pickup_time: order.pickupTimeSlot,
        delivery_date: order.deliveryDate ? new Date(order.deliveryDate).toLocaleDateString() : null,
        delivery_time: order.deliveryTimeSlot
      },
      subject: `Order Status Update - ${order.orderNumber}`
    });
  }

  private static async getOrderWithDetails(orderId: string): Promise<OrderWithDetails> {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: { 
        customer: true,
        items: true
      }
    });

    if (!order) {
      throw new Error('Order not found');
    }

    return order as OrderWithDetails;
  }

  private static formatVariations(variations: any): string {
    try {
      const variationsArray = typeof variations === 'string' ? 
        JSON.parse(variations) : 
        Array.isArray(variations) ? variations : [];
      
      return variationsArray
        .map((v: any) => `${v.type}: ${v.value}`)
        .join(', ');
    } catch (e) {
      console.error('Error parsing variations:', e);
      return '';
    }
  }
}
