import { Customer } from '@prisma/client';
import { EmailService } from '../lib/email';

export class UserEmailService {
  static async sendWelcomeEmail(customer: Customer) {
    return EmailService.sendEmail({
      to: { 
        email: customer.email, 
        name: `${customer.firstName} ${customer.lastName}` 
      },
      subject: 'Welcome to Pinewraps! 🎉',
      template: 'welcome',
      context: {
        customerName: `${customer.firstName} ${customer.lastName}`,
        loginProvider: customer.provider,
        email: customer.email,
        verificationStatus: customer.isEmailVerified ? 'Verified' : 'Pending Verification'
      }
    });
  }

  static async sendPasswordResetEmail(customer: Customer, resetLink: string) {
    return EmailService.sendEmail({
      to: {
        email: customer.email,
        name: `${customer.firstName} ${customer.lastName}`
      },
      subject: 'Reset Your Password',
      template: 'password-reset',
      context: {
        customerName: `${customer.firstName} ${customer.lastName}`,
        resetLink,
        expiryTime: '1 hour'
      }
    });
  }
}
