const frontendUrl = process.env.FRONTEND_URL || 'https://pinewraps.com';
const apiUrl = process.env.API_URL || 'https://pinewraps-api.onrender.com';

export const paymentConfig = {
  ngenius: {
    apiKey: process.env.NGENIUS_API_KEY,
    apiUrl: process.env.NGENIUS_API_URL || 'https://api-gateway.sandbox.ngenius-payments.com',
    outletRef: process.env.NGENIUS_OUTLET_REF,
    merchantId: process.env.NGENIUS_MERCHANT_ID,
    web: {
      redirectUrl: `${apiUrl}/api/payments/callback`,
      cancelUrl: `${apiUrl}/api/payments/callback?cancelled=true`,
    },
    mobile: {
      redirectUrl: `${apiUrl}/api/payments/mobile-callback`,
      cancelUrl: `${apiUrl}/api/payments/mobile-callback?cancelled=true`,
    },
    environment: process.env.NODE_ENV,
    baseUrl: frontendUrl,
    currency: 'AED',
    paymentAction: 'SALE',
    merchantAttributes: {
      skipConfirmationPage: true,
      skip3DS: false,
      paymentOperation: "PURCHASE",
      paymentType: "CARD",
      paymentBrand: "ALL"
    }
  }
};
