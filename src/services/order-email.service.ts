import { prisma } from '../lib/prisma';
import { Order, OrderItem, Customer, OrderStatus } from '@prisma/client';
import { EmailService } from '../lib/email';
import { formatCurrency } from '../utils/currency';

interface OrderWithDetails extends Order {
  customer: Customer;
  items: OrderItem[];
}

export class OrderEmailService {
  private static readonly STATUS_TEMPLATES = {
    [OrderStatus.PENDING]: {
      template: 'order-pending',
      subject: 'Order Received - Pending Confirmation',
      message: 'Your order has been received and is pending confirmation.'
    },
    [OrderStatus.PROCESSING]: {
      template: 'order-processing',
      subject: 'Order Confirmed - Processing',
      message: 'Your order has been confirmed and is being processed.'
    },
    [OrderStatus.READY_FOR_PICKUP]: {
      template: 'order-ready',
      subject: 'Order Ready for Pickup',
      message: 'Your order is ready for pickup at our store.'
    },
    [OrderStatus.OUT_FOR_DELIVERY]: {
      template: 'order-delivery',
      subject: 'Order Out for Delivery',
      message: 'Your order is out for delivery.'
    },
    [OrderStatus.DELIVERED]: {
      template: 'order-delivered',
      subject: 'Order Delivered',
      message: 'Your order has been delivered successfully.'
    },
    [OrderStatus.CANCELLED]: {
      template: 'order-cancelled',
      subject: 'Order Cancelled',
      message: 'Your order has been cancelled.'
    },
    [OrderStatus.COMPLETED]: {
      template: 'order-completed',
      subject: 'Order Completed',
      message: 'Your order has been completed. Thank you for shopping with us!'
    }
  };

  private static async getOrderDetails(orderId: string): Promise<OrderWithDetails> {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        customer: true,
        items: true
      }
    });

    if (!order) {
      throw new Error(`Order not found: ${orderId}`);
    }

    return order as OrderWithDetails;
  }

  static async sendOrderConfirmation(orderId: string) {
    const order = await this.getOrderDetails(orderId);
    
    return EmailService.sendEmail({
      to: {
        email: order.customer.email,
        name: `${order.customer.firstName} ${order.customer.lastName}`
      },
      subject: `Order Confirmation - #${order.orderNumber}`,
      template: 'order-confirmation',
      context: {
        customerName: `${order.customer.firstName} ${order.customer.lastName}`,
        orderNumber: order.orderNumber,
        orderDate: order.createdAt.toLocaleDateString(),
        items: order.items.map(item => ({
          ...item,
          totalPrice: formatCurrency(item.price * item.quantity)
        })),
        subtotal: formatCurrency(order.subtotal),
        tax: formatCurrency(order.tax),
        total: formatCurrency(order.total),
        shippingAddress: order.shippingAddress,
        deliveryDate: order.deliveryDate?.toLocaleDateString(),
        deliveryTime: order.deliveryTime,
        deliveryInstructions: order.deliveryInstructions,
        orderStatus: order.status,
        paymentStatus: order.paymentStatus,
        isGift: order.isGift,
        giftMessage: order.giftMessage,
        giftRecipient: order.isGift ? {
          name: order.giftRecipientName,
          phone: order.giftRecipientPhone
        } : null
      }
    });
  }

  static async sendOrderStatusUpdate(orderId: string, status: OrderStatus) {
    const order = await this.getOrderDetails(orderId);
    const template = this.STATUS_TEMPLATES[status];

    if (!template) {
      throw new Error(`No email template found for status: ${status}`);
    }

    return EmailService.sendEmail({
      to: {
        email: order.customer.email,
        name: `${order.customer.firstName} ${order.customer.lastName}`
      },
      subject: `${template.subject} - #${order.orderNumber}`,
      template: template.template,
      context: {
        customerName: `${order.customer.firstName} ${order.customer.lastName}`,
        orderNumber: order.orderNumber,
        orderDate: order.createdAt.toLocaleDateString(),
        items: order.items.map(item => ({
          ...item,
          totalPrice: formatCurrency(item.price * item.quantity)
        })),
        total: formatCurrency(order.total),
        message: template.message,
        deliveryDate: order.deliveryDate?.toLocaleDateString(),
        deliveryTime: order.deliveryTime,
        trackingNumber: order.trackingNumber,
        trackingUrl: order.trackingUrl
      }
    });
  }

  static async sendOrderEmail(orderId: string, subject: string, customMessage: string) {
    const order = await this.getOrderDetails(orderId);

    return EmailService.sendEmail({
      to: {
        email: order.customer.email,
        name: `${order.customer.firstName} ${order.customer.lastName}`
      },
      subject: `${subject} - #${order.orderNumber}`,
      template: 'order-custom',
      context: {
        customerName: `${order.customer.firstName} ${order.customer.lastName}`,
        orderNumber: order.orderNumber,
        message: customMessage,
        orderStatus: order.status,
        deliveryDate: order.deliveryDate?.toLocaleDateString(),
        deliveryTime: order.deliveryTime
      }
    });
  }
}
