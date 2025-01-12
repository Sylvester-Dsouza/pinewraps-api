import nodemailer from 'nodemailer';
import { formatCurrency } from '../utils/currency';

export class EmailService {
  private static getTransporter() {
    // Verify required environment variables
    if (!process.env.BREVO_SMTP_USER || !process.env.BREVO_SMTP_KEY) {
      console.error('Missing SMTP credentials:', {
        hasUser: !!process.env.BREVO_SMTP_USER,
        hasKey: !!process.env.BREVO_SMTP_KEY
      });
      throw new Error('SMTP credentials not configured');
    }

    return nodemailer.createTransport({
      host: 'smtp-relay.brevo.com',
      port: 587,
      secure: false,
      auth: {
        user: process.env.BREVO_SMTP_USER,
        pass: process.env.BREVO_SMTP_KEY
      },
      debug: process.env.NODE_ENV !== 'production',
      logger: process.env.NODE_ENV !== 'production'
    });
  }

  private static getEmailTemplate(template: string, context: Record<string, any>): string {
    console.log('Generating email template:', {
      template,
      contextKeys: Object.keys(context)
    });

    // Order confirmation specific template
    if (template === 'order-confirmation') {
      const { orderNumber, items, total, subTotal, tax, shippingCost, customerName, orderLink } = context;
      
      // Validate required fields
      if (!orderNumber || !items || !total || !customerName) {
        console.error('Missing required template variables:', {
          hasOrderNumber: !!orderNumber,
          hasItems: !!items,
          hasTotal: !!total,
          hasCustomerName: !!customerName
        });
        throw new Error('Missing required template variables');
      }

      const itemsHtml = items.map((item: any) => `
        <div class="order-item">
          <div><strong>${item.name}</strong> x ${item.quantity}</div>
          <div>${item.variant ? `Variant: ${item.variant}` : ''}</div>
          <div>${item.cakeWriting ? `Cake Writing: ${item.cakeWriting}` : ''}</div>
          <div class="text-right">${formatCurrency(item.price * item.quantity)}</div>
        </div>
      `).join('');

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
              <p>Thank you for your order! We're excited to prepare your delicious treats.</p>
              
              <div class="order-details">
                <h2>Order Details</h2>
                <div class="order-items">
                  ${itemsHtml}
                </div>
                
                <div class="order-total">
                  <p><strong>Subtotal:</strong> <span class="text-right">${formatCurrency(subTotal)}</span></p>
                  ${tax ? `<p><strong>Tax:</strong> <span class="text-right">${formatCurrency(tax)}</span></p>` : ''}
                  ${shippingCost ? `<p><strong>Shipping:</strong> <span class="text-right">${formatCurrency(shippingCost)}</span></p>` : ''}
                  <p><strong>Total:</strong> <span class="text-right">${formatCurrency(total)}</span></p>
                </div>
              </div>
              
              ${orderLink ? `
                <div style="text-align: center;">
                  <a href="${orderLink}" class="btn">View Order Details</a>
                </div>
              ` : ''}
            </div>
            
            <div class="footer">
              <p>If you have any questions about your order, please contact us.</p>
              <p>Best regards,<br>The Pinewraps Team</p>
            </div>
          </div>
        </body>
        </html>
      `;
    }

    throw new Error(`Email template '${template}' not found`);
  }

  static async sendEmail({ 
    to, 
    subject, 
    template, 
    context = {}, 
    attachments = [] 
  }: { 
    to: { 
      email: string; 
      name: string; 
    }; 
    subject: string; 
    template: string; 
    context?: Record<string, any>; 
    attachments?: Array<{ 
      filename: string; 
      content: string; 
      encoding?: string; 
    }>; 
  }) {
    try {
      console.log('Starting email send process:', {
        to: to.email,
        subject,
        template,
        hasContext: !!context
      });

      // Get transporter
      const transporter = this.getTransporter();

      // Generate HTML from template
      const html = this.getEmailTemplate(template, {
        ...context,
        customerName: to.name,
      });

      // Prepare email options
      const mailOptions = {
        from: {
          name: process.env.EMAIL_FROM_NAME || 'Pinewraps',
          address: process.env.EMAIL_FROM_ADDRESS || 'no-reply@pinewraps.com'
        },
        to: `${to.name} <${to.email}>`,
        subject,
        html,
        attachments
      };

      console.log('Sending email with options:', {
        from: mailOptions.from,
        to: mailOptions.to,
        subject: mailOptions.subject,
        hasHtml: !!mailOptions.html,
        attachmentsCount: mailOptions.attachments?.length
      });

      // Send email
      const info = await transporter.sendMail(mailOptions);

      console.log('Email sent successfully:', {
        messageId: info.messageId,
        response: info.response,
        to: to.email,
        subject
      });
      
      return info;
    } catch (error: any) {
      console.error('Failed to send email:', {
        error: error.message,
        stack: error.stack,
        code: error.code,
        command: error.command,
        response: error.response,
        to: to.email,
        subject
      });
      throw error;
    }
  }
}
