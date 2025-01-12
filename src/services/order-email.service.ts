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
    try {
      console.log('Starting order confirmation email process:', { orderId });

      // Fetch order with all necessary details
      console.log('Fetching order details...');
      const order = await prisma.order.findUnique({
        where: { id: orderId },
        include: {
          customer: true,
          items: {
            include: {
              product: true
            }
          },
          shippingAddress: true
        }
      });

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
        name: item.product.name,
        quantity: item.quantity,
        price: item.price,
        variant: item.variant,
        cakeWriting: item.cakeWriting
      }));

      // Generate order link
      const orderLink = `${process.env.NEXT_PUBLIC_WEBSITE_URL}/account/orders/${order.id}`;

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
          subTotal: order.subTotal,
          tax: order.tax,
          shippingCost: order.shippingCost,
          total: order.total,
          orderLink,
          shippingAddress: order.shippingAddress
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

      const order = await this.getOrderDetails(orderId);
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

  static async sendOrderEmail(orderId: string, subject: string, customMessage: string) {
    try {
      console.log('Starting custom order email process:', { orderId, subject });

      const order = await this.getOrderDetails(orderId);

      console.log('Sending custom email:', {
        orderId,
        orderNumber: order.orderNumber,
        subject,
        email: order.customer.email
      });

      await EmailService.sendEmail({
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

      console.log('Custom order email sent successfully:', {
        orderId,
        orderNumber: order.orderNumber,
        subject,
        email: order.customer.email
      });
    } catch (error: any) {
      console.error('Failed to send custom order email:', {
        error: error.message,
        stack: error.stack,
        orderId,
        subject,
        code: error.code,
        response: error.response
      });
      throw error;
    }
  }
}
