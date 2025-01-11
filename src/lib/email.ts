import nodemailer from 'nodemailer';

// Create reusable transporter object using SMTP transport
const transporter = nodemailer.createTransport({
  host: 'smtp-relay.brevo.com',
  port: 587,
  secure: false, // true for 465, false for other ports
  auth: {
    user: process.env.BREVO_SMTP_USER || '81bf74003@smtp-brevo.com', // fallback for development
    pass: process.env.BREVO_SMTP_KEY || 'RMXLv6rAwW5OcJjh', // fallback for development
  },
});

export class EmailService {
  private static getEmailTemplate(template: string, context: Record<string, any>): string {
    // Basic HTML template
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
        template
      });
      
      return info;
    } catch (error) {
      console.error('Error sending email:', {
        error,
        to: to.email,
        subject,
        template
      });
      throw error;
    }
  }

  static async verifyConnection() {
    try {
      await transporter.verify();
      console.log('SMTP connection verified successfully');
      return true;
    } catch (error) {
      console.error('SMTP connection verification failed:', error);
      return false;
    }
  }
}
