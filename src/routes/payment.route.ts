import { Router } from 'express';
import {
  confirmCodPayment,
  initiateEsewaPayment,
  verifyEsewaPayment,
  initiateKhaltiPayment,
  verifyKhaltiPayment,
} from '../controllers/payment.controller';
import { createPaymentIntent } from '../controllers/stripe.controller';
import { authenticate } from '../middlewares/auth';
import { validateBody } from '../middlewares/validation';
import {
  confirmCodPaymentSchema,
  initiateEsewaPaymentSchema,
  verifyEsewaPaymentSchema,
  initiateKhaltiPaymentSchema,
  verifyKhaltiPaymentSchema,
} from '../validations/payment.validation';

const router = Router();

// Cash on Delivery payment
router.post('/cod/confirm', authenticate, validateBody(confirmCodPaymentSchema), confirmCodPayment);

// eSewa payment
router.post('/esewa/initiate', authenticate, validateBody(initiateEsewaPaymentSchema), initiateEsewaPayment);
router.post('/esewa/verify', authenticate, validateBody(verifyEsewaPaymentSchema), verifyEsewaPayment);

// Khalti payment
router.post('/khalti/initiate', authenticate, validateBody(initiateKhaltiPaymentSchema), initiateKhaltiPayment);
router.post('/khalti/verify', authenticate, validateBody(verifyKhaltiPaymentSchema), verifyKhaltiPayment);

// Stripe card payment — intent creation (webhook is mounted in app.ts before express.json())
router.post('/stripe/intent', authenticate, createPaymentIntent);

export default router;
