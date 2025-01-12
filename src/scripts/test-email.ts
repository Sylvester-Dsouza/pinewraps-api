import { OrderEmailService } from '../services/order-email.service';

async function main() {
  const orderId = process.argv[2];
  if (!orderId) {
    console.error('Please provide an order ID as an argument');
    process.exit(1);
  }

  try {
    console.log('Sending test email for order:', orderId);
    await OrderEmailService.sendOrderConfirmation(orderId);
    console.log('Email sent successfully!');
  } catch (error) {
    console.error('Failed to send email:', error);
    process.exit(1);
  }
}

main();
