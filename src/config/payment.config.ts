const frontendUrl = 'http://4e35-106-201-187-229.ngrok-free.app';
const baseUrl = 'http://4e35-106-201-187-229.ngrok-free.app';

export const paymentConfig = {
  ngenius: {
    apiKey: process.env.NGENIUS_API_KEY,
    apiUrl: process.env.NGENIUS_API_URL || 'https://api-gateway.sandbox.ngenius-payments.com',
    outletRef: process.env.NGENIUS_OUTLET_REF,
    redirectUrl: `${baseUrl}/api/payments/callback`,
    cancelUrl: `${baseUrl}/api/payments/callback?cancelled=true`,
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
