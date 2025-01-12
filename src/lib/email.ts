import nodemailer from 'nodemailer';
import { formatCurrency } from '../utils/currency';

console.log('Creating SMTP transport with config:', {
  host: 'smtp-relay.brevo.com',
  port: 587,
  user: process.env.BREVO_SMTP_USER || '81bf74003@smtp-brevo.com'
});

// Create reusable transporter object using SMTP transport
const transporter = nodemailer.createTransport({
  host: 'smtp-relay.brevo.com',
  port: 587,
  secure: false, // true for 465, false for other ports
  auth: {
    user: process.env.BREVO_SMTP_USER || '81bf74003@smtp-brevo.com',
    pass: process.env.BREVO_SMTP_KEY || 'RMXLv6rAwW5OcJjh'
  },
  debug: true, // show debug output
  logger: true // log information in console
});

export class EmailService {
  private static getEmailTemplate(template: string, context: Record<string, any>): string {
    // Order confirmation specific template
    if (template === 'order-confirmation') {
      const { orderNumber, items, total, subTotal, tax, shippingCost, customerName, orderLink } = context;
      return `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { text-align: center; margin-bottom: 30px; }
            .content { margin-bottom: 30px; }
            .footer { text-align: center; font-size: 12px; color: #666; }
            .order-details { background: #f9f9f9; padding: 20px; border-radius: 8px; margin: 20px 0; }
            .order-items { margin: 20px 0; }
            .order-item { padding: 10px 0; border-bottom: 1px solid #eee; }
            .order-total { margin-top: 20px; border-top: 2px solid #eee; padding-top: 20px; }
            .btn { display: inline-block; padding: 12px 24px; background: #000; color: #fff; text-decoration: none; border-radius: 6px; margin: 20px 0; }
            .text-right { text-align: right; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>Order Confirmation</h1>
              <p>Order #${orderNumber}</p>
            </div>
            
            <div class="content">
              <p>Dear ${customerName},</p>
              <p>Thank you for your order! We're excited to confirm that your order has been received and is being processed.</p>

              <div class="order-details">
                <h2>Order Details</h2>
                <div class="order-items">
                  ${items.map((item: any) => `
                    <div class="order-item">
                      <p><strong>${item.name}</strong> ${item.variant ? `(${item.variant})` : ''}</p>
                      <p>Quantity: ${item.quantity} × ${formatCurrency(item.price)}</p>
                      ${item.cakeWriting ? `<p>Cake Writing: "${item.cakeWriting}"</p>` : ''}
                    </div>
                  `).join('')}
                </div>

                <div class="order-total">
                  <p><strong>Subtotal:</strong> <span class="text-right">${formatCurrency(subTotal)}</span></p>
                  <p><strong>Shipping:</strong> <span class="text-right">${formatCurrency(shippingCost)}</span></p>
                  <p><strong>Tax:</strong> <span class="text-right">${formatCurrency(tax)}</span></p>
                  <p><strong>Total:</strong> <span class="text-right">${formatCurrency(total)}</span></p>
                </div>
              </div>

              <div style="text-align: center;">
                <a href="${orderLink}" class="btn">View Order Details</a>
              </div>

              <p>If you have any questions about your order, please don't hesitate to contact us.</p>
            </div>

            <div class="footer">
              <p> ${new Date().getFullYear()} Pinewraps. All rights reserved.</p>
              <p>This email was sent to ${context.email}</p>
            </div>
          </div>
        </body>
        </html>
      `;
    }

    // Default template for other emails
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { text-align: center; margin-bottom: 30px; }
          .content { margin-bottom: 30px; }
          .footer { text-align: center; font-size: 12px; color: #666; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>${context.title || 'Pinewraps'}</h1>
          </div>
          
          <div class="content">
            <p>Dear ${context.customerName},</p>
            ${context.content || ''}
          </div>

          <div class="footer">
            <p> ${new Date().getFullYear()} Pinewraps. All rights reserved.</p>
            <p>This email was sent to ${context.email}</p>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  static async verifyConnection() {
    try {
      console.log('Verifying SMTP connection...');
      const result = await transporter.verify();
      console.log('SMTP connection verified:', result);
      return true;
    } catch (error) {
      console.error('SMTP connection verification failed:', {
        error: error.message,
        code: error.code,
        command: error.command,
        response: error.response,
        responseCode: error.responseCode,
        stack: error.stack
      });
      return false;
    }
  }

  static async sendEmail({
    to,
    subject,
    template,
    context,
    attachments = [],
  }: {
    to: { email: string; name: string };
    subject: string;
    template: string;
    context: Record<string, any>;
    attachments?: Array<{
      filename: string;
      content: string | Buffer;
      contentType?: string;
    }>;
  }) {
    try {
      // Generate HTML from template
      const html = this.getEmailTemplate(template, {
        ...context,
        email: to.email,
        customerName: to.name,
      });

      console.log('Sending email with config:', {
        from: {
          name: process.env.EMAIL_FROM_NAME || 'Pinewraps',
          address: process.env.EMAIL_FROM_ADDRESS || 'support@pinewraps.com',
        },
        to: `${to.name} <${to.email}>`,
        subject,
        template
      });

      // Send email
      const info = await transporter.sendMail({
        from: {
          name: process.env.EMAIL_FROM_NAME || 'Pinewraps',
          address: process.env.EMAIL_FROM_ADDRESS || 'support@pinewraps.com',
        },
        to: `${to.name} <${to.email}>`,
        subject,
        html,
        attachments,
      });

      console.log('Email sent successfully:', {
        messageId: info.messageId,
        to: to.email,
        subject,
        template,
        response: info.response
      });
      
      return info;
    } catch (error) {
      console.error('Error sending email:', {
        error: error.message,
        code: error.code,
        command: error.command,
        response: error.response,
        responseCode: error.responseCode,
        stack: error.stack,
        to: to.email,
        subject,
        template
      });
      throw error;
    }
  }
}
