import { Router } from 'express';
import { authenticate } from '../middlewares/auth';
import { validateBody } from '../middlewares/validation';
import { applyVoucherSchema } from '../validations/voucher.validation';
import { applyVoucher } from '../controllers/voucher.controller';

const router = Router();

router.post('/apply', authenticate, validateBody(applyVoucherSchema), applyVoucher);

export default router;
