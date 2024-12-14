import { PrismaClient } from '@prisma/client';
import { initializeSuperAdmin, auth } from '../src/lib/firebase-admin';

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
    name: 'Sets',
    description: 'Perfect combinations of cakes and flowers',
    isActive: true
  },
];

const SUPER_ADMIN = {
  email: 'admin@pinewraps.com',
  password: 'Admin@123'
};

async function main() {
  try {
    console.log('Starting to seed database...');
    
    // Clean up existing categories
    console.log('Cleaning up existing categories...');
    await prisma.category.deleteMany();

    // Create or update super admin user
    console.log('Setting up super admin user...');
    
    try {
      // Try to get existing Firebase user
      const firebaseUser = await auth.getUserByEmail(SUPER_ADMIN.email);
      console.log('Found existing Firebase user:', firebaseUser.uid);
      
      // Delete any existing user in our database
      await prisma.user.deleteMany({
        where: { email: SUPER_ADMIN.email }
      });
      
      // Create user in our database with existing Firebase UID
      await prisma.user.create({
        data: {
          id: firebaseUser.uid,
          email: SUPER_ADMIN.email,
          role: 'SUPER_ADMIN',
          firebaseUid: firebaseUser.uid,
          isActive: true
        }
      });
      
      // Update Firebase claims
      await auth.setCustomUserClaims(firebaseUser.uid, {
        role: 'SUPER_ADMIN',
        timestamp: Date.now()
      });
      
      console.log('Super admin user updated successfully');
    } catch (error: any) {
      if (error?.errorInfo?.code === 'auth/user-not-found') {
        // If user doesn't exist in Firebase, create new
        await initializeSuperAdmin(SUPER_ADMIN.email, SUPER_ADMIN.password);
        console.log('Super admin user created successfully');
      } else {
        throw error;
      }
    }

    // Create the default categories
    console.log('Creating new categories...');
    for (const category of DEFAULT_CATEGORIES) {
      await prisma.category.create({
        data: {
          id: `CAT_${category.name.toUpperCase().replace(/\s+/g, '')}`,
          name: category.name,
          description: category.description,
          isActive: category.isActive,
          slug: category.name.toLowerCase().replace(/\s+/g, '-')
        },
      });
      console.log(`Created category: ${category.name}`);
    }

    console.log('Database seeded successfully');
  } catch (error) {
    console.error('Error seeding database:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
