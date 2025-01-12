import { EmailService } from '../lib/email';
import { prisma } from '../lib/prisma';
import { OrderStatus } from '@prisma/client';

type OrderWithDetails = Awaited<ReturnType<typeof prisma.order.findUnique>> & {
  customer: { firstName: string; lastName: string; email: string };
  items: Array<{
    name: string;
    quantity: number;
    price: number;
    variant?: string;
    cakeWriting?: string;
  }>;
};

export class OrderEmailService {
  private static readonly STATUS_TEMPLATES = {
    [OrderStatus.PROCESSING]: {
      subject: 'Order Processing',
      template: 'order-status',
      message: 'Your order is being processed and will be prepared soon.'
    },
    [OrderStatus.READY_FOR_PICKUP]: {
      subject: 'Order Ready',
      template: 'order-status',
      message: 'Your order is ready for pickup/delivery.'
    },
    [OrderStatus.OUT_FOR_DELIVERY]: {
      subject: 'Order Out for Delivery',
      template: 'order-status',
      message: 'Your order is out for delivery.'
    },
    [OrderStatus.DELIVERED]: {
      subject: 'Order Delivered',
      template: 'order-status',
      message: 'Your order has been delivered. Enjoy!'
    },
    [OrderStatus.CANCELLED]: {
      subject: 'Order Cancelled',
      template: 'order-status',
      message: 'Your order has been cancelled.'
    }
  };

  static async sendOrderConfirmation(orderId: string) {
    try {
      console.log('Starting order confirmation email process:', { orderId });

      // Fetch order with all necessary details
      console.log('Fetching order details...');
      const order = await prisma.order.findUnique({
        where: { id: orderId },
        include: {
          customer: true,
          items: true
        }
      }) as OrderWithDetails;

      if (!order) {
        console.error('Order not found for email:', { orderId });
        throw new Error('Order not found');
      }

      console.log('Order found:', {
        orderId,
        orderNumber: order.orderNumber,
        customerEmail: order.customer.email,
        itemCount: order.items.length
      });

      // Format order items for email
      const items = order.items.map(item => ({
        name: item.name,
        quantity: item.quantity,
        price: item.price,
        variant: item.variant,
        cakeWriting: item.cakeWriting
      }));

      // Generate order link
      const websiteUrl = process.env.NEXT_PUBLIC_WEBSITE_URL || 'https://pinewraps.com';
      const orderLink = `${websiteUrl}/account/orders/${order.id}`;

      console.log('Preparing to send email with data:', {
        orderId,
        orderNumber: order.orderNumber,
        email: order.customer.email,
        itemCount: items.length,
        hasOrderLink: !!orderLink
      });

      // Send confirmation email
      await EmailService.sendEmail({
        to: {
          email: order.customer.email,
          name: `${order.customer.firstName} ${order.customer.lastName}`
        },
        subject: `Order Confirmation - #${order.orderNumber}`,
        template: 'order-confirmation',
        context: {
          customerName: `${order.customer.firstName} ${order.customer.lastName}`,
          orderNumber: order.orderNumber,
          items,
          subTotal: order.subtotal,
          tax: 0,
          shippingCost: order.deliveryCharge || 0,
          total: order.total,
          orderLink,
          deliveryMethod: order.deliveryMethod,
          deliveryDate: order.deliveryDate,
          deliveryTimeSlot: order.deliveryTimeSlot,
          pickupDate: order.pickupDate,
          pickupTimeSlot: order.pickupTimeSlot,
          storeLocation: order.storeLocation,
          streetAddress: order.streetAddress,
          apartment: order.apartment,
          emirate: order.emirate,
          city: order.city,
          pincode: order.pincode
        }
      });

      console.log('Order confirmation email sent successfully:', {
        orderId,
        orderNumber: order.orderNumber,
        email: order.customer.email
      });
    } catch (error: any) {
      console.error('Failed to send order confirmation email:', {
        error: error.message,
        stack: error.stack,
        orderId,
        code: error.code,
        response: error.response
      });
      throw error;
    }
  }

  static async sendOrderStatusUpdate(orderId: string, status: OrderStatus) {
    try {
      console.log('Starting order status update email process:', { orderId, status });

      const order = await prisma.order.findUnique({
        where: { id: orderId },
        include: {
          customer: true,
          items: true
        }
      }) as OrderWithDetails;

      if (!order) {
        console.error('Order not found for status update email:', { orderId });
        throw new Error('Order not found');
      }

      const template = this.STATUS_TEMPLATES[status];
      if (!template) {
        throw new Error(`No email template found for status: ${status}`);
      }

      console.log('Sending status update email:', {
        orderId,
        orderNumber: order.orderNumber,
        status,
        email: order.customer.email
      });

      await EmailService.sendEmail({
        to: {
          email: order.customer.email,
          name: `${order.customer.firstName} ${order.customer.lastName}`
        },
        subject: `${template.subject} - #${order.orderNumber}`,
        template: template.template,
        context: {
          customerName: `${order.customer.firstName} ${order.customer.lastName}`,
          orderNumber: order.orderNumber,
          status,
          message: template.message,
          orderLink: `${process.env.NEXT_PUBLIC_WEBSITE_URL || 'https://pinewraps.com'}/account/orders/${order.id}`
        }
      });

      console.log('Order status update email sent successfully:', {
        orderId,
        orderNumber: order.orderNumber,
        status,
        email: order.customer.email
      });
    } catch (error: any) {
      console.error('Failed to send order status update email:', {
        error: error.message,
        stack: error.stack,
        orderId,
        status,
        code: error.code,
        response: error.response
      });
      throw error;
    }
  }
}
