import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';
import productRoutes from './routes/product.routes';
import categoryRoutes from './routes/category.routes';
import orderRoutes from './routes/order.routes';
import adminAuthRoutes from './routes/admin-auth.routes';
import adminRoutes from './routes/admin.routes';
import couponRoutes from './routes/coupon.routes';
import rewardRoutes from './routes/reward.routes';
import customerRoutes from './routes/customer.routes';
import customerAuthRoutes from './routes/customer-auth.routes';
import paymentRoutes from './routes/payment.routes';
import { errorHandler } from './middleware/errorHandler';

const app = express();

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Configure CORS
app.use(cors({
  origin: [
    'http://localhost:3000', 
    'http://localhost:3001', 
    'http://localhost:3002',
    'http://192.168.1.2:3001'
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-requested-with']
}));

// Enable pre-flight requests for all routes
app.options('*', cors());

app.use(morgan('dev'));
app.use(cookieParser());

// Basic route for API health check
app.get('/health', (req: express.Request, res: express.Response) => {
  res.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

// Routes
app.use('/api/admin-auth', adminAuthRoutes); 
app.use('/api/customers/auth', customerAuthRoutes); 
app.use('/api/customers', customerRoutes); 
app.use('/api/products', productRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/admins', adminRoutes); 
app.use('/api/coupons', couponRoutes);
app.use('/api/rewards', rewardRoutes);
app.use('/api/payments', paymentRoutes);

// Welcome route
app.get('/', (req: express.Request, res: express.Response) => {
  res.json({ message: 'Welcome to Pinewraps API' });
});

// Error handling middleware (should be last)
app.use(errorHandler);

export default app;
