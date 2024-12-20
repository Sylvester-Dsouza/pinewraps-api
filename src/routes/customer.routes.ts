import { Router } from 'express';
import { CustomerController } from '../controllers/customer.controller';
import { AddressController } from '../controllers/address.controller';
import { apiLimiter } from '../middleware/rate-limit';
import { requireAuth, requireAdmin } from '../middleware/auth';

const router = Router();

// Customer profile endpoints
router.get('/profile', requireAuth, CustomerController.getCustomerProfile);

// Address management
router.get('/addresses', requireAuth, AddressController.getAddresses);
router.post('/addresses', requireAuth, AddressController.createAddress);
router.put('/addresses/:id', requireAuth, AddressController.updateAddress);
router.delete('/addresses/:id', requireAuth, AddressController.deleteAddress);
router.put('/addresses/:id/default', requireAuth, AddressController.setDefaultAddress);

// Password reset endpoints with rate limiting
router.post('/request-reset', apiLimiter, CustomerController.requestPasswordReset);
router.post('/reset-password', apiLimiter, CustomerController.resetPassword);

// Admin endpoints
router.get('/', requireAuth, requireAdmin, CustomerController.getAllCustomers);
router.get('/:id', requireAuth, requireAdmin, CustomerController.getCustomerById);
router.delete('/:id', requireAuth, requireAdmin, CustomerController.deleteCustomer);

export default router;
