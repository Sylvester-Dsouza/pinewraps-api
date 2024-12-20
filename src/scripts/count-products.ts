import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function countProducts() {
  try {
    const totalProducts = await prisma.product.count();
    const activeProducts = await prisma.product.count({
      where: {
        isDeleted: false
      }
    });
    const deletedProducts = await prisma.product.count({
      where: {
        isDeleted: true
      }
    });

    console.log('Product Count:');
    console.log('-------------');
    console.log(`Total Products: ${totalProducts}`);
    console.log(`Active Products: ${activeProducts}`);
    console.log(`Deleted Products: ${deletedProducts}`);

  } catch (error) {
    console.error('Error counting products:', error);
  } finally {
    await prisma.$disconnect();
  }
}

countProducts();
