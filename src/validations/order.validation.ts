import { z } from 'zod';
import { OrderStatus, PaymentMethod, PaymentStatus } from '../types/index';

const orderItemSchema = z
  .object({
    productId: z.string().min(1, 'Product ID is required'),
    quantity: z.number().int().positive('Quantity must be at least 1'),
  })
  .strict();

export const createOrderSchema = z
  .object({
    items: z.array(orderItemSchema).min(1, 'At least one order item is required'),
    deliveryAddressId: z.string().min(1, 'Delivery address ID is required'),
    paymentMethod: z.enum([
      PaymentMethod.CASH_ON_DELIVERY,
      PaymentMethod.ESEWA,
      PaymentMethod.KHALTI,
    ]),
    notes: z.string().max(1000, 'Notes must be at most 1000 characters').optional(),
    couponCode: z.string().min(1, 'Coupon code cannot be empty').optional(),
  })
  .strict();

export type CreateOrderRequest = z.infer<typeof createOrderSchema>;

export const updateOrderStatusSchema = z
  .object({
    status: z.enum([
      OrderStatus.PENDING,
      OrderStatus.CONFIRMED,
      OrderStatus.SHIPPED,
      OrderStatus.DELIVERED,
      OrderStatus.CANCELLED,
      OrderStatus.RETURNED,
    ]),
  })
  .strict();

export type UpdateOrderStatusRequest = z.infer<typeof updateOrderStatusSchema>;

export const updatePaymentStatusSchema = z
  .object({
    paymentStatus: z.enum([
      PaymentStatus.PENDING,
      PaymentStatus.COMPLETED,
      PaymentStatus.FAILED,
      PaymentStatus.REFUNDED,
    ]),
    transactionId: z.string().min(1, 'Transaction ID is required').optional(),
  })
  .strict();

export type UpdatePaymentStatusRequest = z.infer<typeof updatePaymentStatusSchema>;

export const orderIdParamSchema = z
  .object({
    orderId: z.string().min(1, 'Order ID is required'),
  })
  .strict();

export type OrderIdParamRequest = z.infer<typeof orderIdParamSchema>;
