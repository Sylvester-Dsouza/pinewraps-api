import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';
import path from 'path';
import productRoutes from './routes/product.routes';
import categoryRoutes from './routes/category.routes';
import orderRoutes from './routes/order.routes';
import adminAuthRoutes from './routes/admin-auth.routes';
import adminRoutes from './routes/admin.routes';
import couponRoutes from './routes/coupon.routes';
import rewardRoutes from './routes/reward.routes';
import customerAuthRoutes from './routes/customer-auth.routes';
import customerRoutes from './routes/customer.routes';
import testRoutes from './routes/test.routes';
import paymentRoutes from './routes/payment.routes';
import { errorHandler } from './middleware/errorHandler';

const app = express();

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static files from the public directory
app.use(express.static(path.join(__dirname, '../public')));

// Configure CORS
const allowedOrigins = [
  'http://localhost:3000',  // Admin panel local
  'http://localhost:3001',  // API local
  'http://localhost:3002',  // Web local
  'https://admin.pinewraps.com',
  'https://pinewraps-api.onrender.com',
  'https://pinewraps.com',
  'https://www.pinewraps.com',
  'https://pinewraps-web.vercel.app',  // Web staging
  'https://pinewraps-web-git-main.vercel.app',  // Web preview
  'https://pinewraps-web-git-staging.vercel.app'  // Web staging
];

app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);

    if (allowedOrigins.indexOf(origin) === -1) {
      console.error('Blocked origin:', origin);
      const msg = 'The CORS policy for this site does not allow access from the specified Origin.';
      return callback(new Error(msg), false);
    }
    return callback(null, true);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-requested-with']
}));

// Enable pre-flight requests for all routes
app.options('*', cors());

app.use(morgan('dev'));
app.use(cookieParser());

// Routes
app.use('/api/products', productRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/admin-auth', adminAuthRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/coupons', couponRoutes);
app.use('/api/rewards', rewardRoutes);
app.use('/api/customers/auth', customerAuthRoutes);
app.use('/api/customers', customerRoutes);
if (process.env.NODE_ENV === 'development') {
  app.use('/api/test', testRoutes);
}
app.use('/api/payments', paymentRoutes);

// Health check route (no /api prefix for easier access)
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString()
  });
});

// Welcome route
app.get('/', (req: express.Request, res: express.Response) => {
  res.json({ message: 'Welcome to Pinewraps API' });
});

// Error handling middleware (should be last)
app.use(errorHandler);

export default app;
