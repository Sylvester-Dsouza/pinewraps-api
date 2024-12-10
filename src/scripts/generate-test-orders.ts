import { PrismaClient, OrderStatus, DeliveryType, PaymentMethod, CommunicationType } from '@prisma/client';
import { randomUUID } from 'crypto';

const prisma = new PrismaClient();

async function generateTestOrders() {
  try {
    // First, ensure we have a test customer
    const testCustomer = await prisma.customer.upsert({
      where: {
        email: 'test.customer@example.com'
      },
      update: {},
      create: {
        firstName: 'Test',
        lastName: 'Customer',
        email: 'test.customer@example.com',
        phone: '+1234567890',
        customerAddresses: {
          create: {
            street: '123 Test Street',
            city: 'Test City',
            state: 'Test State',
            country: 'USA',
            postalCode: '12345',
            isDefault: true
          }
        }
      }
    });

    // Generate 10 test orders
    for (let i = 0; i < 10; i++) {
      const isDelivery = Math.random() > 0.5;
      const isGift = Math.random() > 0.7;
      const subtotal = Math.floor(Math.random() * 200) + 50; // Random amount between 50 and 250
      const deliveryFee = isDelivery ? 10 : 0;
      const giftWrapCharge = isGift ? 5 : 0;
      const total = subtotal + deliveryFee + giftWrapCharge;

      const orderNumber = `ORD-${Date.now().toString().slice(-6)}-${i + 1}`;
      const status = [OrderStatus.PENDING, OrderStatus.PROCESSING, OrderStatus.COMPLETED][Math.floor(Math.random() * 3)];
      
      // Create the order
      const order = await prisma.order.create({
        data: {
          orderNumber,
          status,
          customerId: testCustomer.id,
          isGift,
          giftWrapCharge,
          deliveryFee,
          subtotal,
          total,
          paymentMethod: PaymentMethod.CREDIT_CARD,
          notes: isGift ? 'Please include a gift message' : undefined,
          adminNotes: 'Test order generated for development',
          items: {
            create: [
              {
                name: 'Chocolate Cake',
                variant: 'Large',
                price: 35.00,
                quantity: 1,
                cakeWriting: isGift ? 'Happy Birthday!' : undefined
              },
              {
                name: 'Cupcakes',
                variant: 'Regular',
                price: 15.00,
                quantity: Math.floor(Math.random() * 3) + 1
              }
            ]
          },
          delivery: {
            create: {
              type: isDelivery ? DeliveryType.DELIVERY : DeliveryType.PICKUP,
              requestedDate: new Date(Date.now() + Math.floor(Math.random() * 7) * 24 * 60 * 60 * 1000),
              requestedTime: isDelivery ? '14:00' : '10:00',
              instructions: isDelivery ? 'Please call upon arrival' : undefined,
              storeLocation: !isDelivery ? 'Main Store' : undefined
            }
          },
          statusHistory: {
            create: {
              status,
              updatedBy: 'system',
              updatedAt: new Date()
            }
          },
          communications: {
            create: {
              type: CommunicationType.EMAIL,
              subject: 'Order Confirmation',
              content: `Thank you for your order ${orderNumber}. We will process it shortly.`,
              sentBy: 'system',
              sentAt: new Date()
            }
          }
        }
      });

      console.log(`Created test order: ${order.orderNumber}`);
    }

    console.log('Successfully generated test orders!');
  } catch (error) {
    console.error('Error generating test orders:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the function
generateTestOrders()
  .then(() => console.log('Finished generating test data'))
  .catch(console.error);
