import { z } from 'zod';

export const applyVoucherSchema = z
  .object({
    code: z.string().min(1, 'Voucher code is required'),
  })
  .strict();

export type ApplyVoucherRequest = z.infer<typeof applyVoucherSchema>;
