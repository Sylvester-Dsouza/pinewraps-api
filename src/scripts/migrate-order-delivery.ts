const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function migrateOrderDelivery() {
  try {
    // Get all orders with their delivery information
    const orders = await prisma.$queryRaw`
      SELECT 
        o.*,
        od.type as delivery_type,
        od.requested_date as delivery_date,
        od.requested_time as delivery_time,
        od.instructions as delivery_instructions,
        od.store_location,
        od.street as street_address,
        od.apartment,
        od.city,
        od.emirates,
        od.country,
        od.postal_code as pincode
      FROM "Order" o
      LEFT JOIN "OrderDelivery" od ON o."id" = od."orderId"
    `;

    // Update each order with the delivery information
    for (const order of orders) {
      await prisma.$executeRaw`
        UPDATE "orders" SET
          "deliveryMethod" = ${order.delivery_type}::text,
          "deliveryDate" = ${order.delivery_date},
          "deliveryTimeSlot" = ${order.delivery_time},
          "deliveryInstructions" = ${order.delivery_instructions},
          "storeLocation" = ${order.store_location},
          "streetAddress" = ${order.street_address},
          "apartment" = ${order.apartment},
          "emirate" = ${order.emirates},
          "city" = ${order.city},
          "pincode" = ${order.postal_code},
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
