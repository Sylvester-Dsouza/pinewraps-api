import { prisma } from '../lib/prisma';
import { Order, OrderItem, Customer, OrderStatus } from '@prisma/client';

// Using require for Brevo SDK
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

  private static readonly STATUS_TEMPLATES = {
    [OrderStatus.PENDING]: {
      templateId: process.env.BREVO_ORDER_PENDING_TEMPLATE_ID,
      subject: 'Order Received - Pending Confirmation',
      message: 'Your order has been received and is pending confirmation.'
    },
    [OrderStatus.PROCESSING]: {
      templateId: process.env.BREVO_ORDER_PROCESSING_TEMPLATE_ID,
      subject: 'Order Confirmed - Processing',
      message: 'Your order has been confirmed and is being processed.'
    },
    [OrderStatus.READY_FOR_PICKUP]: {
      templateId: process.env.BREVO_ORDER_READY_TEMPLATE_ID,
      subject: 'Order Ready for Pickup',
      message: 'Your order is ready for pickup at our store.'
    },
    [OrderStatus.OUT_FOR_DELIVERY]: {
      templateId: process.env.BREVO_ORDER_DELIVERY_TEMPLATE_ID,
      subject: 'Order Out for Delivery',
      message: 'Your order is out for delivery.'
    },
    [OrderStatus.DELIVERED]: {
      templateId: process.env.BREVO_ORDER_DELIVERED_TEMPLATE_ID,
      subject: 'Order Delivered',
      message: 'Your order has been delivered successfully.'
    },
    [OrderStatus.CANCELLED]: {
      templateId: process.env.BREVO_ORDER_CANCELLED_TEMPLATE_ID,
      subject: 'Order Cancelled',
      message: 'Your order has been cancelled.'
    },
    [OrderStatus.COMPLETED]: {
      templateId: process.env.BREVO_ORDER_COMPLETED_TEMPLATE_ID,
      subject: 'Order Completed',
      message: 'Your order has been completed. Thank you for shopping with us!'
    }
  };

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
      
      // Record the communication in the database
      await prisma.orderCommunication.create({
        data: {
          orderId: params.params.order_id,
          type: 'EMAIL',
          subject: params.subject,
          content: JSON.stringify(params.params),
          sentBy: 'SYSTEM',
          sentAt: new Date()
        }
      });

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
        order_id: order.id,
        order_number: order.orderNumber,
        order_date: new Date(order.createdAt).toLocaleDateString(),
        customer_name: `${order.customer.firstName} ${order.customer.lastName}`,
        order_total: order.total.toFixed(2),
        items: order.items.map(item => ({
          name: item.name,
          quantity: item.quantity,
          price: item.price.toFixed(2),
          total: (item.price * item.quantity).toFixed(2),
          variations: this.formatVariations(item.variations),
          cake_writing: item.cakeWriting
        })),
        delivery_method: order.deliveryMethod,
        pickup_date: order.pickupDate ? new Date(order.pickupDate).toLocaleDateString() : null,
        pickup_time: order.pickupTimeSlot,
        pickup_location: order.storeLocation,
        delivery_date: order.deliveryDate ? new Date(order.deliveryDate).toLocaleDateString() : null,
        delivery_time: order.deliveryTimeSlot,
        delivery_instructions: order.deliveryInstructions,
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
        points_redeemed: order.pointsRedeemed,
        points_value: order.pointsValue.toFixed(2),
        coupon_discount: order.couponDiscount.toFixed(2),
        total: order.total.toFixed(2),
        is_gift: order.isGift,
        gift_message: order.giftMessage,
        gift_recipient: order.isGift ? {
          name: order.giftRecipientName,
          phone: order.giftRecipientPhone
        } : null
      },
      subject: `Order Confirmation - ${order.orderNumber}`
    });
  }

  static async sendOrderStatusUpdate(orderId: string, newStatus: string) {
    const order = await this.getOrderWithDetails(orderId);
    const template = this.STATUS_TEMPLATES[newStatus as OrderStatus];
    
    if (!template) {
      console.warn(`No email template found for status: ${newStatus}`);
      return;
    }

    const deliveryInfo = order.deliveryMethod === 'DELIVERY' ? {
      delivery_date: order.deliveryDate ? new Date(order.deliveryDate).toLocaleDateString() : null,
      delivery_time: order.deliveryTimeSlot,
      delivery_instructions: order.deliveryInstructions,
      shipping_address: {
        address: order.streetAddress,
        apartment: order.apartment,
        city: order.city,
        emirate: order.emirate,
        pincode: order.pincode
      }
    } : {
      pickup_date: order.pickupDate ? new Date(order.pickupDate).toLocaleDateString() : null,
      pickup_time: order.pickupTimeSlot,
      pickup_location: order.storeLocation
    };
    
    return this.sendEmail({
      to: { 
        email: order.customer.email, 
        name: `${order.customer.firstName} ${order.customer.lastName}` 
      },
      templateId: Number(template.templateId),
      params: {
        order_id: order.id,
        order_number: order.orderNumber,
        customer_name: `${order.customer.firstName} ${order.customer.lastName}`,
        order_status: newStatus,
        status_message: template.message,
        order_date: new Date(order.createdAt).toLocaleDateString(),
        order_total: order.total.toFixed(2),
        delivery_method: order.deliveryMethod,
        ...deliveryInfo,
        items: order.items.map(item => ({
          name: item.name,
          quantity: item.quantity,
          variations: this.formatVariations(item.variations),
          cake_writing: item.cakeWriting
        }))
      },
      subject: `${template.subject} - ${order.orderNumber}`
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
