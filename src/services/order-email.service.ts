import nodemailer from 'nodemailer';
import { prisma } from '../lib/prisma';

export class OrderEmailService {
  private static transporter = nodemailer.createTransport({
    // Add your email configuration here
    host: process.env.EMAIL_HOST,
    port: Number(process.env.EMAIL_PORT),
    secure: true,
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASSWORD
    }
  });

  static async sendOrderEmail(orderId: string, subject: string, body: string) {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: { 
        customer: true,
        items: true,
        delivery: true
      }
    });

    if (!order) {
      throw new Error('Order not found');
    }

    const mailOptions = {
      from: process.env.EMAIL_FROM,
      to: order.customer.email,
      subject,
      html: body
    };

    return this.transporter.sendMail(mailOptions);
  }

  static async sendOrderConfirmation(orderId: string) {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: { 
        customer: true,
        items: true,
        delivery: true
      }
    });

    if (!order) {
      throw new Error('Order not found');
    }

    const subject = `Order Confirmation - ${order.orderNumber}`;
    const body = this.generateOrderConfirmationEmail(order);

    const mailOptions = {
      from: process.env.EMAIL_FROM,
      to: order.customer.email,
      subject,
      html: body
    };

    return this.transporter.sendMail(mailOptions);
  }

  private static generateOrderConfirmationEmail(order: any) {
    return `
      <h1>Order Confirmation</h1>
      <p>Dear ${order.customer.firstName},</p>
      <p>Thank you for your order! Here are your order details:</p>
      
      <h2>Order Information</h2>
      <p>Order Number: ${order.orderNumber}</p>
      <p>Order Date: ${new Date(order.date).toLocaleDateString()}</p>
      <p>Order Status: ${order.status}</p>
      
      <h2>Items</h2>
      <ul>
        ${order.items.map((item: any) => {
          // Parse variations if they're stored as a string
          let variationsArray = [];
          try {
            if (typeof item.variations === 'string') {
              variationsArray = JSON.parse(item.variations);
            } else if (Array.isArray(item.variations)) {
              variationsArray = item.variations;
            }
          } catch (e) {
            console.error('Error parsing variations:', e);
            variationsArray = [];
          }

          // Format variations for display
          const variationsText = variationsArray
            .map((v: any) => `${v.type}: ${v.value}`)
            .join(', ');

          return `
            <li>
              ${item.name}${variationsText ? ` (${variationsText})` : ''}
              <br>Quantity: ${item.quantity}
              <br>Price: AED ${item.price}
              ${item.cakeWriting ? `<br>Cake Writing: ${item.cakeWriting}` : ''}
            </li>
          `;
        }).join('')}
      </ul>
      
      <h2>Delivery Details</h2>
      <p>Method: ${order.delivery.type}</p>
      <p>Date: ${new Date(order.delivery.requestedDate).toLocaleDateString()}</p>
      <p>Time: ${order.delivery.requestedTime}</p>
      ${order.delivery.storeLocation ? `<p>Store Location: ${order.delivery.storeLocation}</p>` : ''}
      
      <h2>Order Summary</h2>
      <p>Subtotal: AED ${order.subtotal}</p>
      ${order.deliveryFee ? `<p>Delivery Fee: AED ${order.deliveryFee}</p>` : ''}
      ${order.giftWrapCharge ? `<p>Gift Wrap: AED ${order.giftWrapCharge}</p>` : ''}
      ${order.discountAmount ? `<p>Discount: AED ${order.discountAmount}</p>` : ''}
      <p><strong>Total: AED ${order.total}</strong></p>
      
      <p>If you have any questions about your order, please don't hesitate to contact us.</p>
      
      <p>Best regards,<br>The Pinewraps Team</p>
    `;
  }
}
