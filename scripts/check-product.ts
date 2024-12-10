import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkProduct(productId: string) {
  try {
    const product = await prisma.product.findUnique({
      where: { id: productId },
      include: {
        category: true,
        variations: {
          include: {
            options: true
          }
        },
        images: true
      }
    });

    console.log('Product data:', JSON.stringify(product, null, 2));
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Replace with your product ID
checkProduct('5a8aef6a-5ffd-422c-a9f9-976d92a359df');
