import { Router } from 'express';
import { EmailService } from '../lib/email';
import { asyncHandler } from '../middleware/async.handler';

const router = Router();

router.post('/test-email', asyncHandler(async (req, res) => {
  const { email } = req.body;

  if (!email) {
    return res.status(400).json({
      success: false,
      message: 'Email is required'
    });
  }

  // First verify SMTP connection
  const isConnected = await EmailService.verifyConnection();
  if (!isConnected) {
    return res.status(500).json({
      success: false,
      message: 'Failed to connect to SMTP server'
    });
  }

  // Send test email
  await EmailService.sendEmail({
    to: {
      email,
      name: 'Test User'
    },
    subject: 'Test Email from Pinewraps',
    template: 'test',
    context: {
      title: 'Welcome to Pinewraps!',
      content: `
        <p>This is a test email to verify that our email system is working correctly.</p>
        <p>If you received this email, it means our email service is configured properly!</p>
        <p>Thank you for your patience.</p>
      `
    }
  });

  res.json({
    success: true,
    message: 'Test email sent successfully'
  });
}));

export default router;
