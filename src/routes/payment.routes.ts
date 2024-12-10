import express from 'express';
import { PaymentController } from '../controllers/payment.controller';
import { requireAuth } from '../middleware/auth';

const router = express.Router();

// Create a payment for an order
router.post('/create', requireAuth, PaymentController.createPayment);

// Handle payment callback from N-Genius (no auth required)
router.get('/callback', PaymentController.handleCallback);

// Get payment status (no auth required for callback flow)
router.get('/status/:ref', PaymentController.getPaymentStatus);

// Refund a payment (admin only)
router.post('/refund', requireAuth, PaymentController.refundPayment);

export default router;
