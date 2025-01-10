import { prisma } from '../lib/prisma';
import { OrderStatus, Emirates, RewardTier, RewardHistoryType } from '../models/order.model';
import { PaymentStatus, PaymentMethod } from '@prisma/client';
import WebSocketService from './websocket.service';
import { calculateRewardPoints, getCustomerTier } from '../utils/rewards';

export class OrderService {
  private static wsService: WebSocketService | null = null;

  public static initialize(wsService: WebSocketService) {
    OrderService.wsService = wsService;
  }

  static async getOrders(params: {
    page: number;
    limit: number;
    status?: OrderStatus | 'all';
    search?: string;
    userId?: string;
    userRole?: string;
    userEmail?: string;
  }) {
    const { page = 1, limit = 10, status, search, userId, userRole, userEmail } = params;

    // Build where clause
    const where: any = {};
    
    // Apply filters based on user role
    if (userRole === 'ADMIN' || userRole === 'SUPER_ADMIN') {
      // Admin users can see all orders
      if (status && status !== 'all') {
        where.status = status;
      }
    } else {
      // Non-admin users can only see their own orders
      where.customer = { email: userEmail };
      if (status && status !== 'all') {
        where.status = status;
      }
    }
    
    if (search) {
      where.OR = [
        { orderNumber: { contains: search, mode: 'insensitive' } },
        { customer: { firstName: { contains: search, mode: 'insensitive' } } },
        { customer: { lastName: { contains: search, mode: 'insensitive' } } },
        { customer: { email: { contains: search, mode: 'insensitive' } } }
      ];
    }

    // Get total count for pagination
    const total = await prisma.order.count({ where });

    // Get orders with related data
    const orders = await prisma.order.findMany({
      where,
      skip: (page - 1) * limit,
      take: limit,
      orderBy: {
        createdAt: 'desc'
      },
      include: {
        customer: true,
        items: true,
        couponUsages: {
          include: {
            coupon: true
          }
        },
        statusHistory: {
          orderBy: {
            updatedAt: 'desc'
          }
        },
        snapshot: {
          select: {
            customerName: true,
            customerEmail: true,
            customerPhone: true,
            streetAddress: true,
            apartment: true,
            emirate: true,
            city: true,
            pincode: true
          }
        }
      }
    });

    // Transform orders
    const transformedOrders = orders.map(order => {
      const transformed = this.transformOrder(order);
      return transformed;
    });

    return {
      results: transformedOrders,
      pagination: {
        total,
        page,
        limit
      }
    };
  }

  static async getOrder(orderId: string) {
    const [order, snapshot] = await Promise.all([
      prisma.order.findUnique({
        where: { id: orderId },
        include: {
          customer: true,
          items: true,
          payment: true,
          couponUsages: {
            include: {
              coupon: true
            }
          },
          statusHistory: {
            orderBy: {
              updatedAt: 'desc'
            }
          }
        }
      }),
      prisma.orderSnapshot.findFirst({
        where: { orderId },
        select: {
          customerName: true,
          customerEmail: true,
          customerPhone: true,
          streetAddress: true,
          apartment: true,
          emirate: true,
          city: true,
          pincode: true
        }
      })
    ]);

    if (!order) {
      throw new Error('Order not found');
    }

    // Combine live order with snapshot data
    const transformedOrder = this.transformOrder(order);

    return transformedOrder;
  }

  static async getOrderSnapshot(orderId: string) {
    try {
      const snapshot = await prisma.orderSnapshot.findFirst({
        where: { orderId },
        select: {
          customerName: true,
          customerEmail: true,
          customerPhone: true,
          streetAddress: true,
          apartment: true,
          emirate: true,
          city: true,
          pincode: true,
          createdAt: true
        }
      });

      if (!snapshot) {
        throw new Error(`Order snapshot not found for order ID: ${orderId}`);
      }

      return {
        customerInformation: {
          name: snapshot.customerName,
          email: snapshot.customerEmail,
          phone: snapshot.customerPhone
        },
        shippingAddress: {
          street: snapshot.streetAddress || '',
          apartment: snapshot.apartment || '',
          emirate: snapshot.emirate || '',
          city: snapshot.city || '',
          pincode: snapshot.pincode || ''
        },
        createdAt: snapshot.createdAt
      };
    } catch (error) {
      console.error('Error getting order snapshot:', error);
      throw error;
    }
  }

  static async createOrder(orderData: any) {
    const {
      idempotencyKey,
      firstName,
      lastName,
      email,
      phone,
      streetAddress,
      apartment,
      emirate,
      city,
      pincode,
      deliveryMethod,
      deliveryDate,
      deliveryTimeSlot,
      deliveryInstructions,
      pickupDate,
      pickupTimeSlot,
      storeLocation,
      paymentMethod,
      items,
      subtotal,
      isGift,
      giftMessage,
      giftRecipientName,
      giftRecipientPhone,
      notes,
      couponCode,
      pointsRedeemed
    } = orderData;

    // Floor all numeric values at the start
    const wholeSubtotal = Math.floor(orderData.subtotal);
    const wholeDeliveryCharge = Math.floor(
      orderData.deliveryMethod === 'DELIVERY' 
        ? (orderData.emirate?.toUpperCase() === 'DUBAI' ? 30 : 50) 
        : 0
    );

    // Handle coupon
    const { couponId, discountAmount: couponDiscount } = await this.handleCoupon({
      ...orderData,
      subtotal: wholeSubtotal // Pass whole number subtotal
    });

    // Calculate points value
    const wholePointsValue = Math.floor((orderData.pointsRedeemed || 0) * 0.25);

    // Calculate final total
    const finalTotal = Math.floor(Math.max(0,
      wholeSubtotal
      - couponDiscount // Already floored in handleCoupon
      - wholePointsValue
      + wholeDeliveryCharge
    ));

    console.log('Order creation amounts:', {
      subtotal: wholeSubtotal,
      couponDiscount,
      pointsValue: wholePointsValue,
      deliveryCharge: wholeDeliveryCharge,
      finalTotal,
    });

    // Validate required fields
    if (!email || !phone || !deliveryMethod) {
      throw new Error('Missing required fields');
    }

    // Find customer by email
    const customer = await prisma.customer.findUnique({
      where: { email }
    });

    if (!customer) {
      throw new Error('Customer not found');
    }

    // Get or create customer reward record
    let customerReward = await prisma.customerReward.findFirst({
      where: { customerId: customer.id }
    });

    if (!customerReward) {
      customerReward = await prisma.customerReward.create({
        data: {
          customerId: customer.id,
          points: 0,
          tier: 'GREEN'
        }
      });
    }

    // Calculate points to be earned (but not yet confirmed)
    const pointsToEarn = calculateRewardPoints(finalTotal, customerReward.totalPoints || 0);

    // Create the order with rewards information
    const order = await prisma.order.create({
      data: {
        orderNumber: await OrderService.generateOrderNumber(),
        idempotencyKey,
        status: OrderStatus.PENDING,
        paymentMethod,
        paymentStatus: paymentMethod === PaymentMethod.CREDIT_CARD ? PaymentStatus.PENDING : PaymentStatus.CAPTURED,
        
        // Customer Information
        customer: {
          connect: {
            id: customer.id
          }
        },
        customerPhone: phone,
        
        // Points Information
        pointsEarned: pointsToEarn,
        pointsRedeemed: pointsRedeemed || 0,
        pointsValue: wholePointsValue,
        
        // Delivery Method
        deliveryMethod,
        
        // Delivery Information
        deliveryDate: deliveryMethod === 'DELIVERY' ? new Date(deliveryDate + 'T00:00:00Z') : null,
        deliveryTimeSlot: deliveryMethod === 'DELIVERY' ? deliveryTimeSlot : null,
        deliveryInstructions: deliveryMethod === 'DELIVERY' ? deliveryInstructions : null,
        deliveryCharge: wholeDeliveryCharge,
        
        // Pickup Information
        pickupDate: deliveryMethod === 'PICKUP' ? new Date(pickupDate + 'T00:00:00Z') : null,
        pickupTimeSlot: deliveryMethod === 'PICKUP' ? pickupTimeSlot : null,
        storeLocation: deliveryMethod === 'PICKUP' ? storeLocation : null,
        
        // Address Information
        streetAddress: deliveryMethod === 'DELIVERY' ? streetAddress : null,
        apartment: deliveryMethod === 'DELIVERY' ? apartment : null,
        emirate: deliveryMethod === 'DELIVERY' ? emirate : 'Dubai',
        city: deliveryMethod === 'DELIVERY' ? city : 'Dubai',
        pincode: deliveryMethod === 'DELIVERY' ? pincode : null,
        country: 'United Arab Emirates',
        
        // Totals
        subtotal: wholeSubtotal,
        total: finalTotal,
        couponDiscount,
        deliveryCharge: wholeDeliveryCharge,
        
        // Gift Information
        ...(isGift ? {
          isGift: true,
          giftMessage: giftMessage || null,
          giftRecipientName: giftRecipientName || null,
          giftRecipientPhone: giftRecipientPhone || null,
        } : {
          isGift: false,
          giftMessage: null,
          giftRecipientName: null,
          giftRecipientPhone: null,
        }),
        
        // Admin Notes
        adminNotes: notes || null,
        
        // Coupon
        ...(couponId ? {
          coupon: {
            connect: {
              id: couponId
            }
          }
        } : {}),
        
        // Items
        items: {
          create: items.map(item => ({
            name: item.name,
            variant: item.variant || '',
            variations: item.variations || [],
            price: Math.floor(item.price),
            quantity: parseInt(item.quantity.toString()) || 1,
            cakeWriting: item.cakeWriting || null
          }))
        }
      },
      include: {
        items: true,
        customer: true
      }
    });

    // Create order snapshot
    await OrderService.createOrderSnapshot(order);

    // Send notification about new order
    this.sendOrderUpdate(order.id, 'NEW', order.customerId);

    // Send order confirmation email
    try {
      const { OrderEmailService } = await import('./order-email.service');
      await OrderEmailService.sendOrderConfirmation(order.id);
    } catch (error) {
      console.error('Error sending order confirmation email:', error);
      // Don't throw error here to prevent order creation from failing
    }

    // Only deduct redeemed points if any were used
    if (pointsRedeemed > 0) {
      await prisma.$transaction([
        prisma.customer.update({
          where: { id: customer.id },
          data: {
            rewardPoints: {
              decrement: pointsRedeemed
            }
          }
        }),
        prisma.customerReward.update({
          where: { id: customerReward.id },
          data: {
            points: {
              decrement: pointsRedeemed
            },
            totalPoints: {
              decrement: pointsRedeemed
            }
          }
        }),
        prisma.rewardHistory.create({
          data: {
            customer: { connect: { id: customer.id } },
            pointsEarned: 0,
            pointsRedeemed: pointsRedeemed,
            orderTotal: finalTotal,
            action: RewardHistoryType.REDEEMED,
            description: `Redeemed ${pointsRedeemed} points for AED ${(pointsRedeemed * 0.25).toFixed(2)}`,
            order: { connect: { id: order.id } },
            reward: { connect: { id: customerReward.id } }
          }
        })
      ]);
    }

    return order;
  }

  static async updateOrderStatus(orderId: string, status: OrderStatus, updatedBy: string) {
    try {
      // First check if the order exists
      const existingOrder = await prisma.order.findUnique({
        where: { id: orderId },
        include: {
          customer: true,
          statusHistory: {
            orderBy: {
              updatedAt: 'desc'
            }
          }
        }
      });

      if (!existingOrder) {
        throw new Error('Order not found');
      }

      // Create status history entry
      await prisma.orderStatusHistory.create({
        data: {
          orderId: orderId,
          status: status,
          notes: `Status changed from ${existingOrder.status} to ${status}`,
          updatedBy: updatedBy
        }
      });

      // Update the order status
      const updatedOrder = await prisma.order.update({
        where: { id: orderId },
        data: {
          status: status,
          updatedAt: new Date()
        },
        include: {
          customer: true,
          items: true,
          statusHistory: {
            orderBy: {
              updatedAt: 'desc'
            },
            take: 5 // Get last 5 status changes
          }
        }
      });

      // Send order status update email
      try {
        const { OrderEmailService } = await import('./order-email.service');
        await OrderEmailService.sendOrderStatusUpdate(orderId, status);
        console.log('Order status update email sent');
      } catch (error) {
        console.error('Error sending order status update email:', error);
      }

      // Notify through WebSocket if available
      this.sendOrderUpdate(orderId, status, updatedOrder.customerId);

      return updatedOrder;
    } catch (error) {
      console.error('Error updating order status:', error);
      throw error;
    }
  }

  static async cancelOrder(orderId: string) {
    try {
      // Update order status to cancelled
      const order = await prisma.order.update({
        where: {
          id: orderId
        },
        data: {
          status: OrderStatus.CANCELLED,
          statusHistory: {
            create: {
              status: OrderStatus.CANCELLED,
              updatedBy: 'customer'
            }
          }
        },
        include: {
          customer: true,
          items: true,
          statusHistory: true
        }
      });

      // If order had redeemed points, refund them
      if (order.pointsRedeemed > 0) {
        // Get the customer's reward record
        const customerReward = await prisma.customer.findUnique({
          where: { id: order.customerId },
          include: { reward: true }
        });

        if (customerReward?.reward) {
          // Update the customer's reward points
          await prisma.customerReward.update({
            where: { id: customerReward.reward.id },
            data: {
              points: {
                increment: order.pointsRedeemed
              }
            }
          });

          // Record the refund in reward history
          await prisma.rewardHistory.create({
            data: {
              customer: {
                connect: {
                  id: order.customerId
                }
              },
              pointsEarned: 0,
              pointsRedeemed: order.pointsRedeemed,
              orderTotal: 0,
              action: RewardHistoryType.EARNED,
              description: `Refunded ${order.pointsRedeemed} points from cancelled order ${order.orderNumber}`,
              order: {
                connect: {
                  id: order.id
                }
              },
              reward: {
                connect: {
                  id: customerReward.reward.id
                }
              }
            }
          });
        }
      }

      // Notify through WebSocket if available
      this.sendOrderUpdate(orderId, 'CANCELLED', order.customerId);

      return order;
    } catch (error) {
      console.error('Error cancelling order:', error);
      throw error;
    }
  }

  static async createOrderSnapshot(order: any) {
    if (!order) throw new Error('Order not found');

    // Create order snapshot with only essential customer and shipping details
    const orderSnapshot = await prisma.orderSnapshot.create({
      data: {
        // Order relation
        orderId: order.id,
        
        // Customer Information
        customerName: order.customer ? `${order.customer.firstName} ${order.customer.lastName}` : '',
        customerEmail: order.customer ? order.customer.email : '',
        customerPhone: order.customer ? (order.customer.phone || '') : '',
        
        // Address Information
        streetAddress: order.streetAddress || '',
        apartment: order.apartment || '',
        emirate: order.emirate || '',
        city: order.city || '',
        pincode: order.pincode || ''
      }
    });

    return orderSnapshot;
  }

  static async handleCoupon(orderData: any) {
    let couponDiscount = 0;
    let appliedCoupon = null;

    if (orderData.couponCode) {
      const coupon = await prisma.coupon.findFirst({
        where: {
          code: orderData.couponCode,
          status: 'ACTIVE',
          startDate: { lte: new Date() },
          OR: [
            { endDate: null },
            { endDate: { gte: new Date() } }
          ]
        }
      });

      if (coupon) {
        // Always use whole numbers for calculation
        const wholeSubtotal = Math.floor(orderData.subtotal);
        
        if (!coupon.minOrderAmount || wholeSubtotal >= Math.floor(coupon.minOrderAmount)) {
          if (coupon.type === 'PERCENTAGE') {
            // Calculate percentage discount
            const wholePercentage = Math.floor(coupon.value);
            couponDiscount = Math.floor((wholeSubtotal * wholePercentage) / 100);
            
            // Apply max discount if specified
            if (coupon.maxDiscount) {
              couponDiscount = Math.min(couponDiscount, Math.floor(coupon.maxDiscount));
            }

            console.log('Percentage coupon calculation:', {
              subtotal: wholeSubtotal,
              percentage: wholePercentage,
              calculatedDiscount: couponDiscount,
              maxDiscount: coupon.maxDiscount ? Math.floor(coupon.maxDiscount) : 'none'
            });
          } else {
            // Fixed amount discount
            couponDiscount = Math.min(Math.floor(coupon.value), wholeSubtotal);
            
            console.log('Fixed amount coupon calculation:', {
              subtotal: wholeSubtotal,
              fixedAmount: Math.floor(coupon.value),
              calculatedDiscount: couponDiscount
            });
          }
          appliedCoupon = coupon;
        }
      }
    }

    return { 
      couponId: appliedCoupon?.id, 
      discountAmount: couponDiscount // Already floored in calculations
    };
  }

  private static async recordCouponUsage(coupon: any, order: any, customer: any, discountAmount: number) {
    await Promise.all([
      prisma.couponUsage.create({
        data: {
          coupon: {
            connect: {
              id: coupon.id
            }
          },
          order: {
            connect: {
              id: order.id
            }
          },
          customer: {
            connect: {
              id: customer.id
            }
          },
          discount: discountAmount
        }
      }),
      prisma.coupon.update({
        where: { id: coupon.id },
        data: { usageCount: { increment: 1 } }
      })
    ]);
  }

  private static async generateOrderNumber(): Promise<string> {
    const maxRetries = 5;
    let retryCount = 0;

    while (retryCount < maxRetries) {
      try {
        return await prisma.$transaction(async (tx) => {
          const date = new Date();
          const year = date.getFullYear().toString().slice(-2);
          const month = (date.getMonth() + 1).toString().padStart(2, '0');
          
          // Get the latest order number for this month
          const latestOrder = await tx.order.findFirst({
            where: {
              orderNumber: {
                startsWith: `ORD-${year}${month}-`
              }
            },
            orderBy: {
              orderNumber: 'desc'
            }
          });
          
          let sequence: number;
          if (latestOrder) {
            // Extract the sequence number from the latest order number
            const lastSequence = parseInt(latestOrder.orderNumber.split('-')[2]);
            sequence = lastSequence + 1;
          } else {
            sequence = 1;
          }
          
          // Format: ORD-YYMM-XXXX where XXXX is sequential
          const paddedSequence = sequence.toString().padStart(4, '0');
          const orderNumber = `ORD-${year}${month}-${paddedSequence}`;
          
          // Verify uniqueness within transaction
          const existingOrder = await tx.order.findFirst({
            where: { orderNumber },
          });
          
          if (existingOrder) {
            throw new Error('Retry needed: Order number collision');
          }
          
          return orderNumber;
        });
      } catch (error) {
        retryCount++;
        if (retryCount === maxRetries) {
          throw new Error('Failed to generate unique order number after multiple attempts');
        }
        // Add a small random delay before retrying
        await new Promise(resolve => setTimeout(resolve, Math.random() * 100));
      }
    }

    throw new Error('Failed to generate order number');
  }

  private static calculatePoints = (total: number, tier: string): number => {
    const tierMultipliers = {
      'GREEN': 0.07,
      'SILVER': 0.12,
      'GOLD': 0.15,
      'PLATINUM': 0.20
    };
    const multiplier = tierMultipliers[tier as keyof typeof tierMultipliers] || 0.07;
    return Math.floor(total * multiplier);
  };

  private static async processOrder(orderData: any, userId: string) {
    const { items, total, useRewardPoints, pointsToRedeem } = orderData;

    // Start transaction
    return await prisma.$transaction(async (prisma) => {
      // Get user's current rewards
      const customerReward = await prisma.customerReward.findUnique({
        where: { customerId: userId },
        include: { history: true }
      });

      if (!customerReward) {
        throw new Error('Customer rewards not found');
      }

      // Handle points redemption if requested
      let finalTotal = total;
      if (useRewardPoints && pointsToRedeem > 0) {
        const maxRedeemable = Math.min(customerReward.points, pointsToRedeem);
        const rewardsDiscount = Math.min((maxRedeemable * 0.25), total * 0.25);
        finalTotal = Math.max(0, total - rewardsDiscount);

        // Create redemption history
        await prisma.rewardHistory.create({
          data: {
            customer: {
              connect: {
                id: userId
              }
            },
            pointsEarned: 0,
            pointsRedeemed: maxRedeemable,
            orderTotal: 0,
            action: RewardHistoryType.REDEEMED,
            description: `Redeemed ${maxRedeemable} points for AED ${rewardsDiscount.toFixed(2)} discount`,
            order: {
              connect: {
                id: orderData.id
              }
            },
            reward: {
              connect: {
                id: customerReward.id
              }
            }
          }
        });

        // Update customer's points
        await prisma.customerReward.update({
          where: { customerId: userId },
          data: {
            points: {
              decrement: maxRedeemable
            }
          }
        });
      }

      // Calculate points earned from this order
      const pointsEarned = OrderService.calculatePoints(finalTotal, customerReward.tier);

      // Create points earned history
      if (pointsEarned > 0) {
        await prisma.rewardHistory.create({
          data: {
            customer: {
              connect: {
                id: userId
              }
            },
            pointsEarned: pointsEarned,
            pointsRedeemed: 0,
            orderTotal: finalTotal,
            action: RewardHistoryType.EARNED,
            description: `Earned ${pointsEarned} points from order #${orderData.id}`,
            order: {
              connect: {
                id: orderData.id
              }
            },
            reward: {
              connect: {
                id: customerReward.id
              }
            }
          }
        });

        // Update customer's points and total points
        await prisma.customerReward.update({
          where: { customerId: userId },
          data: {
            points: {
              increment: pointsEarned
            },
            totalPoints: {
              increment: pointsEarned
            }
          }
        });
      }

      // Create the order
      const order = await prisma.order.create({
        data: {
          ...orderData,
          userId,
          total: finalTotal,
          pointsEarned,
          pointsRedeemed: useRewardPoints ? pointsToRedeem : 0
        }
      });

      return order;
    });
  }

  private static sendOrderUpdate(orderId: string, status: string, customerId: string) {
    try {
      if (!OrderService.wsService) {
        console.warn('WebSocket service not initialized');
        return;
      }
      OrderService.wsService.sendOrderUpdate(orderId, status, customerId);
    } catch (error) {
      console.error('Error sending order update:', error);
    }
  }

  private static transformOrder(order: any) {
    const customerName = `${order.customer?.firstName || ''} ${order.customer?.lastName || ''}`.trim();
    
    // Calculate subtotal from items
    const subtotal = order.items?.reduce((acc: number, item: any) => {
      return acc + (item.price * item.quantity);
    }, 0) || 0;
    
    // Transform order with address from both order and snapshot
    const transformedOrder = {
      id: order.id,
      orderNumber: order.orderNumber,
      idempotencyKey: order.idempotencyKey,
      status: order.status,
      date: order.date,
      createdAt: order.createdAt,
      total: order.total,
      subtotal: order.subtotal || subtotal,
      pointsEarned: order.pointsEarned,
      pointsRedeemed: order.pointsRedeemed,
      pointsValue: order.pointsValue,
      discountAmount: order.discountAmount,
      adminNotes: order.adminNotes,
      customerName,
      customerPhone: order.customerPhone || order.customer?.phone,
      deliveryMethod: order.deliveryMethod,
      deliveryDate: order.deliveryDate,
      deliveryTimeSlot: order.deliveryTimeSlot,
      deliveryCharge: order.deliveryCharge,
      deliveryInstructions: order.deliveryInstructions,
      pickupDate: order.pickupDate,
      pickupTimeSlot: order.pickupTimeSlot,
      storeLocation: order.storeLocation,
      // Use order address as primary, fallback to snapshot
      streetAddress: order.streetAddress || order.snapshot?.streetAddress || '',
      apartment: order.apartment || order.snapshot?.apartment || '',
      emirate: order.emirate || order.snapshot?.emirate || '',
      city: order.city || order.snapshot?.city || '',
      pincode: order.pincode || order.snapshot?.pincode || '',
      country: order.country || 'United Arab Emirates',
      // Gift Information
      isGift: order.isGift,
      giftMessage: order.giftMessage,
      giftRecipientName: order.giftRecipientName,
      giftRecipientPhone: order.giftRecipientPhone,
      // Payment Information
      payment: {
        status: order.paymentStatus,
        method: order.paymentMethod,
        id: order.paymentId
      },
      // Coupon Information
      couponCode: order.couponCode,
      couponDiscount: order.couponDiscount,
      items: order.items?.map((item: any) => {
        // Parse variations if they're stored as a string
        let variationsArray = [];
        try {
          if (typeof item.variations === 'string') {
            variationsArray = JSON.parse(item.variations);
          } else if (Array.isArray(item.variations)) {
            variationsArray = item.variations;
          }
        } catch (e) {
          console.error('Error parsing variations:', e);
          variationsArray = [];
        }

        // Format variations for display
        const formattedVariations = variationsArray.map((v: any) => ({
          type: v.type,
          value: v.value,
          label: `${v.type}: ${v.value}`
        }));

        return {
          id: item.id,
          name: item.name,
          variant: item.variant,
          variations: formattedVariations,
          variationsText: formattedVariations.map(v => v.label).join(', '),
          price: item.price,
          quantity: item.quantity,
          cakeWriting: item.cakeWriting
        };
      }) || [],
      customer: order.customer ? {
        id: order.customer.id,
        name: customerName,
        email: order.customer.email,
        phone: order.customer.phone
      } : null,
      statusHistory: order.statusHistory?.map((history: any) => ({
        id: history.id,
        status: history.status,
        notes: history.notes,
        createdAt: history.createdAt,
        updatedBy: history.updatedBy
      })) || []
    };

    return transformedOrder;
  }
}
