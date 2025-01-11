import nodemailer from 'nodemailer';

console.log('Creating SMTP transport with config:', {
  host: 'smtp-relay.brevo.com',
  port: 587,
  user: '81bf74003@smtp-brevo.com'
});

// Create reusable transporter object using SMTP transport
const transporter = nodemailer.createTransport({
  host: 'smtp-relay.brevo.com',
  port: 587,
  secure: false, // true for 465, false for other ports
  auth: {
    user: '81bf74003@smtp-brevo.com',
    pass: 'RMXLv6rAwW5OcJjh'
  },
  debug: true, // show debug output
  logger: true // log information in console
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
