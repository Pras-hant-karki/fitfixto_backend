import { z } from 'zod';

export const confirmCodPaymentSchema = z
  .object({
    orderId: z.string().min(1, 'Order ID is required'),
  })
  .strict();

export type ConfirmCodPaymentRequest = z.infer<typeof confirmCodPaymentSchema>;

export const initiateEsewaPaymentSchema = z
  .object({
    orderId: z.string().min(1, 'Order ID is required'),
    amount: z.number().positive('Amount must be positive'),
  })
  .strict();

export type InitiateEsewaPaymentRequest = z.infer<typeof initiateEsewaPaymentSchema>;

export const verifyEsewaPaymentSchema = z
  .object({
    transactionId: z.string().min(1, 'Transaction ID is required'),
    orderId: z.string().min(1, 'Order ID is required'),
    status: z.enum(['success', 'failure', 'pending']),
  })
  .strict();

export type VerifyEsewaPaymentRequest = z.infer<typeof verifyEsewaPaymentSchema>;

export const initiateKhaltiPaymentSchema = z
  .object({
    orderId: z.string().min(1, 'Order ID is required'),
    amount: z.number().positive('Amount must be positive'),
  })
  .strict();

export type InitiateKhaltiPaymentRequest = z.infer<typeof initiateKhaltiPaymentSchema>;

export const verifyKhaltiPaymentSchema = z
  .object({
    token: z.string().min(1, 'Token is required'),
    orderId: z.string().min(1, 'Order ID is required'),
    status: z.enum(['success', 'failure', 'pending']),
  })
  .strict();

export type VerifyKhaltiPaymentRequest = z.infer<typeof verifyKhaltiPaymentSchema>;
