import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function migrateOrderDelivery() {
  try {
    // First, let's check the table structure
    const tableInfo = await prisma.$queryRaw`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'Order'
    `;
    
    console.log('Order table structure:', tableInfo);

    // Get all orders with their delivery information
    const orders = await prisma.$queryRaw`
      SELECT 
        o.*,
        od."type" as delivery_type,
        od."requestedDate" as delivery_date,
        od."requestedTime" as delivery_time,
        od."instructions" as delivery_instructions,
        od."storeLocation" as store_location,
        od."street" as street_address,
        od."apartment",
        od."city",
        od."emirates",
        od."country",
        od."postalCode" as pincode
      FROM "Order" o
      LEFT JOIN "OrderDelivery" od ON o."id" = od."orderId"
    `;

    console.log('Found orders:', orders.length);

    // Update each order with the delivery information
    for (const order of orders) {
      console.log('Updating order:', order.id);
      await prisma.$executeRaw`
        UPDATE "Order" SET
          "deliveryMethod" = ${order.delivery_type}::"DeliveryType",
          "deliveryDate" = ${order.delivery_date},
          "deliveryTimeSlot" = ${order.delivery_time},
          "deliveryInstructions" = ${order.delivery_instructions},
          "storeLocation" = ${order.store_location},
          "streetAddress" = ${order.street_address},
          "apartment" = ${order.apartment},
          "emirate" = ${order.emirates}::"Emirates",
          "city" = ${order.city},
          "pincode" = ${order.pincode},
          "country" = ${order.country}
        WHERE "id" = ${order.id}
      `;
    }

    console.log('Migration completed successfully');
  } catch (error) {
    console.error('Migration failed:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

migrateOrderDelivery().catch(console.error);
