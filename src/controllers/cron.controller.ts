import { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import { sendSuccess } from '../utils/apiResponse';
import { HTTP_STATUS } from '../constants/app.constants';
import { AppError } from '../utils/appError';
import Stripe from 'stripe';
import Order from '../models/Order';
import env from '../config/env';
import { OrderStatus, PaymentStatus } from '../types/index';
import { cancelStalePendingOrder } from './stripe.controller';

// ---------------------------------------------------------------------------
// POST /api/v1/cron/cleanup-pending-orders
//
// Finds Stripe Checkout orders that were created more than 24 hours ago but
// never completed (webhook was missed or never arrived). Verifies with Stripe
// that each session has expired, then cancels the order and restores stock.
//
// Secured with CRON_SECRET header to prevent unauthorized calls.
// Call this endpoint once per hour from your scheduler (Vercel Cron, etc.).
// ---------------------------------------------------------------------------
export const cleanupPendingOrders = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const secret = req.headers['x-cron-secret'];
  if (!env.CRON_SECRET || secret !== env.CRON_SECRET) {
    throw new AppError('Unauthorized', HTTP_STATUS.UNAUTHORIZED);
  }

  if (!env.STRIPE_SECRET_KEY) {
    throw new AppError('Stripe is not configured', HTTP_STATUS.INTERNAL_SERVER_ERROR);
  }

  const stripe = new Stripe(env.STRIPE_SECRET_KEY, { apiVersion: '2026-06-24.dahlia' as any });

  // Find orders that have been PENDING for more than 24 hours with a session ID
  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const stalePendingOrders = await Order.find({
    paymentStatus: PaymentStatus.PENDING,
    stripeSessionId: { $exists: true, $ne: null },
    createdAt: { $lte: cutoff },
  }).limit(50); // process in batches

  let cancelled = 0;
  let skipped = 0;
  const errors: string[] = [];

  for (const order of stalePendingOrders) {
    if (!order.stripeSessionId) continue;

    try {
      const session = await stripe.checkout.sessions.retrieve(order.stripeSessionId);

      if (session.status === 'expired') {
        // Stripe confirmed session expired — cancel order and restore stock
        await cancelStalePendingOrder(order);
        cancelled++;
      } else if (session.status === 'complete') {
        if (session.payment_status === 'paid') {
          // Payment succeeded but webhook was missed — complete the order now
          await Order.findOneAndUpdate(
            { _id: order._id, paymentStatus: PaymentStatus.PENDING },
            { paymentStatus: PaymentStatus.COMPLETED, paidAt: new Date() }
          );
          skipped++;
        } else {
          // Session complete but payment unpaid (e.g. pending bank transfer) — cancel
          await cancelStalePendingOrder(order);
          cancelled++;
        }
      } else {
        // Session still open — leave it; will be caught in a later run
        skipped++;
      }
    } catch (err) {
      errors.push(`Order ${order._id}: ${err instanceof Error ? err.message : 'unknown error'}`);
    }
  }

  return sendSuccess(res, 'Cleanup complete', {
    processed: stalePendingOrders.length,
    cancelled,
    skipped,
    errors,
  }, HTTP_STATUS.OK) as any;
});
