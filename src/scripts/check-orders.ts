import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkOrders() {
  try {
    // Get total count of orders
    const totalOrders = await prisma.order.count();
    console.log('Total orders in database:', totalOrders);

    // Get orders for specific customer
    const customerOrders = await prisma.order.findMany({
      where: {
        customer: {
          email: 'sylvester310dsouza@gmail.com'
        }
      },
      include: {
        customer: true,
        items: true
      }
    });

    console.log('\nOrders for sylvester310dsouza@gmail.com:', customerOrders.length);
    if (customerOrders.length > 0) {
      customerOrders.forEach(order => {
        console.log('\nOrder details:');
        console.log('Order ID:', order.id);
        console.log('Order Number:', order.orderNumber);
        console.log('Status:', order.status);
        console.log('Total:', order.total);
        console.log('Items:', order.items.length);
      });
    }

    // Get all customers with orders
    const customersWithOrders = await prisma.customer.findMany({
      where: {
        orders: {
          some: {}
        }
      },
      include: {
        _count: {
          select: {
            orders: true
          }
        }
      }
    });

    console.log('\nCustomers with orders:');
    customersWithOrders.forEach(customer => {
      console.log(`${customer.email}: ${customer._count.orders} orders`);
    });

  } catch (error) {
    console.error('Error checking orders:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkOrders();
