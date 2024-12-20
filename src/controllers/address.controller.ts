import { Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { z } from 'zod';
import { AddressType, Emirates } from '@prisma/client';

const AddressSchema = z.object({
  street: z.string().min(1, 'Street address is required'),
  apartment: z.string().min(1, 'Apartment is required'),
  emirate: z.enum(['ABU_DHABI', 'DUBAI', 'SHARJAH', 'AJMAN', 'UMM_AL_QUWAIN', 'RAS_AL_KHAIMAH', 'FUJAIRAH']),
  city: z.string().optional().default('Dubai'),
  country: z.string().optional().default('United Arab Emirates'),
  pincode: z.string().min(1, 'Postal code is required'),
  isDefault: z.boolean().optional().default(false),
  type: z.enum(['SHIPPING', 'BILLING']).default('SHIPPING')
});

// Schema for partial updates
const PartialAddressSchema = AddressSchema.partial();

export class AddressController {
  // Get all addresses for the current customer
  static async getAddresses(req: Request, res: Response) {
    try {
      console.log('Getting addresses for user:', req.user?.uid);
      
      const customer = await prisma.customer.findUnique({
        where: { firebaseUid: req.user!.uid },
        include: {
          addresses: {
            orderBy: [
              { isDefault: 'desc' },
              { createdAt: 'desc' }
            ]
          }
        }
      });

      console.log('Found customer:', customer?.id);
      console.log('Customer addresses:', customer?.addresses);

      if (!customer) {
        console.log('Customer not found for UID:', req.user?.uid);
        return res.status(404).json({
          success: false,
          error: {
            code: 'CUSTOMER_NOT_FOUND',
            message: 'Customer not found'
          }
        });
      }

      res.json({
        success: true,
        data: customer.addresses
      });
    } catch (error) {
      console.error('Get addresses error:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to fetch addresses'
        }
      });
    }
  }

  // Create a new address for the customer
  static async createAddress(req: Request, res: Response) {
    try {
      console.log('Creating address for user:', req.user?.uid);
      console.log('Address data:', req.body);
      
      const addressData = AddressSchema.parse(req.body);

      const customer = await prisma.customer.findUnique({
        where: { firebaseUid: req.user!.uid }
      });

      if (!customer) {
        console.log('Customer not found for UID:', req.user?.uid);
        return res.status(404).json({
          success: false,
          error: {
            code: 'CUSTOMER_NOT_FOUND',
            message: 'Customer not found'
          }
        });
      }

      // If this is marked as default, update other addresses
      if (addressData.isDefault) {
        await prisma.customerAddress.updateMany({
          where: { customerId: customer.id },
          data: { isDefault: false }
        });
      }

      const address = await prisma.customerAddress.create({
        data: {
          ...addressData,
          customerId: customer.id,
          type: addressData.type || 'SHIPPING'
        }
      });

      console.log('Created address:', address);

      res.json({
        success: true,
        data: address
      });
    } catch (error) {
      console.error('Create address error:', error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: error.errors[0].message
          }
        });
      }
      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to create address'
        }
      });
    }
  }

  // Update an existing address
  static async updateAddress(req: Request, res: Response) {
    try {
      console.log('Updating address:', req.params.id);
      console.log('Update data:', req.body);
      
      const { id } = req.params;
      const addressData = PartialAddressSchema.parse(req.body);

      const customer = await prisma.customer.findUnique({
        where: { firebaseUid: req.user!.uid }
      });

      if (!customer) {
        console.log('Customer not found for UID:', req.user?.uid);
        return res.status(404).json({
          success: false,
          error: {
            code: 'CUSTOMER_NOT_FOUND',
            message: 'Customer not found'
          }
        });
      }

      // Verify address belongs to customer
      const existingAddress = await prisma.customerAddress.findFirst({
        where: {
          id,
          customerId: customer.id
        }
      });

      if (!existingAddress) {
        console.log('Address not found:', id);
        return res.status(404).json({
          success: false,
          error: {
            code: 'ADDRESS_NOT_FOUND',
            message: 'Address not found'
          }
        });
      }

      // If this is marked as default, update other addresses
      if (addressData.isDefault) {
        await prisma.customerAddress.updateMany({
          where: {
            customerId: customer.id,
            id: { not: id }
          },
          data: { isDefault: false }
        });
      }

      const address = await prisma.customerAddress.update({
        where: { id },
        data: addressData
      });

      console.log('Updated address:', address);

      res.json({
        success: true,
        data: address
      });
    } catch (error) {
      console.error('Update address error:', error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: error.errors[0].message
          }
        });
      }
      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to update address'
        }
      });
    }
  }

  // Set address as default
  static async setDefaultAddress(req: Request, res: Response) {
    try {
      console.log('Setting address as default:', req.params.id);
      
      const { id } = req.params;

      const customer = await prisma.customer.findUnique({
        where: { firebaseUid: req.user!.uid }
      });

      if (!customer) {
        console.log('Customer not found for UID:', req.user?.uid);
        return res.status(404).json({
          success: false,
          error: {
            code: 'CUSTOMER_NOT_FOUND',
            message: 'Customer not found'
          }
        });
      }

      // Verify address belongs to customer
      const existingAddress = await prisma.customerAddress.findFirst({
        where: {
          id,
          customerId: customer.id
        }
      });

      if (!existingAddress) {
        console.log('Address not found:', id);
        return res.status(404).json({
          success: false,
          error: {
            code: 'ADDRESS_NOT_FOUND',
            message: 'Address not found'
          }
        });
      }

      // Update all addresses to not be default
      await prisma.customerAddress.updateMany({
        where: {
          customerId: customer.id,
          id: { not: id }
        },
        data: { isDefault: false }
      });

      // Set the selected address as default
      const address = await prisma.customerAddress.update({
        where: { id },
        data: { isDefault: true }
      });

      console.log('Updated address as default:', address);

      res.json({
        success: true,
        data: address
      });
    } catch (error) {
      console.error('Set default address error:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to set address as default'
        }
      });
    }
  }

  // Delete an address
  static async deleteAddress(req: Request, res: Response) {
    try {
      console.log('Deleting address:', req.params.id);
      
      const { id } = req.params;

      const customer = await prisma.customer.findUnique({
        where: { firebaseUid: req.user!.uid }
      });

      if (!customer) {
        console.log('Customer not found for UID:', req.user?.uid);
        return res.status(404).json({
          success: false,
          error: {
            code: 'CUSTOMER_NOT_FOUND',
            message: 'Customer not found'
          }
        });
      }

      // Verify address belongs to customer
      const existingAddress = await prisma.customerAddress.findFirst({
        where: {
          id,
          customerId: customer.id
        }
      });

      if (!existingAddress) {
        console.log('Address not found:', id);
        return res.status(404).json({
          success: false,
          error: {
            code: 'ADDRESS_NOT_FOUND',
            message: 'Address not found'
          }
        });
      }

      await prisma.customerAddress.delete({
        where: { id }
      });

      console.log('Address deleted:', id);

      res.json({
        success: true,
        message: 'Address deleted successfully'
      });
    } catch (error) {
      console.error('Delete address error:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to delete address'
        }
      });
    }
  }
}
