import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const DEFAULT_CATEGORIES = [
  {
    name: 'Cakes',
    description: 'Delicious custom cakes for all occasions',
    isActive: true
  },
  {
    name: 'Flowers',
    description: 'Beautiful flower arrangements for any occasion',
    isActive: true
  },
  {
    name: 'Combos',
    description: 'Perfect combinations of cakes and flowers',
    isActive: true
  },
];

async function seedCategories() {
  try {
    console.log('Starting to seed categories...');
    
    // Clean up existing categories
    console.log('Cleaning up existing categories...');
    await prisma.category.deleteMany();

    // Create the default categories
    console.log('Creating new categories...');
    for (const category of DEFAULT_CATEGORIES) {
      await prisma.category.create({
        data: {
          name: category.name,
          description: category.description,
          isActive: category.isActive,
          slug: category.name.toLowerCase()
        },
      });
      console.log(`Created category: ${category.name}`);
    }

    console.log('Categories seeded successfully');
  } catch (error) {
    console.error('Error seeding categories:', error);
  } finally {
    await prisma.$disconnect();
  }
}

seedCategories();
