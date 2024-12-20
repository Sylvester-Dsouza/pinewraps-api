import { Router } from 'express';
import { customerAuth } from '../controllers/customer-auth.controller';
import { asyncHandler } from '../middleware/async';

const router = Router();

// Customer authentication routes
router.post('/register', asyncHandler(customerAuth.register));
router.post('/login', asyncHandler(customerAuth.login));
router.post('/social', asyncHandler(customerAuth.socialAuth));
router.post('/session', asyncHandler(customerAuth.createSession));
router.delete('/session', asyncHandler(customerAuth.clearSession));
router.get('/me', asyncHandler(customerAuth.me));
router.put('/profile', asyncHandler(customerAuth.updateProfile));

export default router;
