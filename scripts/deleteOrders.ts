import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function deleteAllOrders() {
  try {
    console.log('Starting to delete all orders...');

    // Delete all order items first due to foreign key constraints
    const deletedOrderItems = await prisma.orderItem.deleteMany();
    console.log(`Deleted ${deletedOrderItems.count} order items`);

    // Delete all order status history records
    const deletedStatusHistory = await prisma.orderStatusHistory.deleteMany();
    console.log(`Deleted ${deletedStatusHistory.count} order status history records`);

    // Delete all order snapshots
    const deletedSnapshots = await prisma.orderSnapshot.deleteMany();
    console.log(`Deleted ${deletedSnapshots.count} order snapshots`);

    // Delete all payments
    const deletedPayments = await prisma.payment.deleteMany();
    console.log(`Deleted ${deletedPayments.count} payments`);

    // Delete all order communications
    const deletedCommunications = await prisma.orderCommunication.deleteMany();
    console.log(`Deleted ${deletedCommunications.count} order communications`);

    // Then delete all orders
    const deletedOrders = await prisma.order.deleteMany();
    console.log(`Deleted ${deletedOrders.count} orders`);

    console.log('Successfully deleted all orders and related records');
  } catch (error) {
    console.error('Error deleting orders:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the function
deleteAllOrders();
