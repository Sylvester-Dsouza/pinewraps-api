import { prisma } from '../lib/prisma';
import { Customer } from '@prisma/client';

// Using require for Brevo SDK
const SibApi = require('@sendinblue/client');

export class UserEmailService {
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

  static async sendWelcomeEmail(customer: Customer) {
    return this.sendEmail({
      to: { 
        email: customer.email, 
        name: `${customer.firstName} ${customer.lastName}` 
      },
      templateId: Number(process.env.BREVO_WELCOME_TEMPLATE_ID),
      params: {
        customer_name: `${customer.firstName} ${customer.lastName}`,
        login_provider: customer.provider,
        email: customer.email,
        verification_status: customer.isEmailVerified ? 'Verified' : 'Pending Verification'
      },
      subject: 'Welcome to Pinewraps!'
    });
  }
}
