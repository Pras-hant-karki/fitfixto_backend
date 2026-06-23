import { z } from 'zod';
import { OrderStatus, PaymentMethod, PaymentStatus } from '../types/index';

export const placeOrderSchema = z
  .object({
    deliveryAddressId: z.string().min(1, 'Delivery address ID is required'),
    paymentMethod: z.enum([
      PaymentMethod.CASH_ON_DELIVERY,
      PaymentMethod.ESEWA,
      PaymentMethod.KHALTI,
    ]),
    notes: z.string().max(1000, 'Notes must be at most 1000 characters').optional(),
    voucherCode: z.string().min(1, 'Voucher code cannot be empty').optional(),
  })
  .strict();

export type PlaceOrderRequest = z.infer<typeof placeOrderSchema>;

export const cancelOrderSchema = z
  .object({
    reason: z.string().max(1000, 'Cancellation reason must be at most 1000 characters').optional(),
  })
  .strict();

export type CancelOrderRequest = z.infer<typeof cancelOrderSchema>;

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

const adminOrderStatusQuerySchema = z
  .string()
  .min(1)
  .transform((value) => value.split(',').map((status) => status.trim()).filter(Boolean))
  .refine(
    (statuses) =>
      statuses.every((status) =>
        [
          'all',
          'processing',
          OrderStatus.PENDING,
          OrderStatus.CONFIRMED,
          OrderStatus.SHIPPED,
          OrderStatus.DELIVERED,
          OrderStatus.CANCELLED,
          OrderStatus.RETURNED,
        ].includes(status)
      ),
    { message: 'Invalid order status' }
  );

export const adminOrderListQuerySchema = z
  .object({
    status: adminOrderStatusQuerySchema.optional(),
    search: z.string().trim().optional(),
    page: z.coerce.number().int().min(1).optional().default(1),
    limit: z.coerce.number().int().min(1).max(100).optional().default(20),
  })
  .strict();

export type AdminOrderListQueryRequest = z.infer<typeof adminOrderListQuerySchema>;

export const orderIdParamSchema = z
  .object({
    orderId: z.string().min(1, 'Order ID is required'),
  })
  .strict();

export type OrderIdParamRequest = z.infer<typeof orderIdParamSchema>;

