import Stripe from 'stripe';
import { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import { sendSuccess } from '../utils/apiResponse';
import { HTTP_STATUS } from '../constants/app.constants';
import { AppError } from '../utils/appError';
import { RequestWithUser } from '../middlewares/auth';
import Cart from '../models/Cart';
import Order from '../models/Order';
import DeliveryAddress from '../models/DeliveryAddress';
import Voucher from '../models/Voucher';
import env from '../config/env';
import { PaymentStatus } from '../types/index';

type CartProduct = {
  _id: string;
  price: number;
  discountPercentage?: number;
  stock: number;
  name: string;
  category: string;
};

const CART_TAX_RATE = 0.02;
const SHIPPING_AMOUNTS = { standard: 0, express: 29, overnight: 79 } as const;
const roundMoney = (n: number) => Math.round(n * 100) / 100;

const getProductMrp = (p: CartProduct) => {
  const d = p.discountPercentage ?? 0;
  return d <= 0 || d >= 100 ? p.price : roundMoney(p.price / (1 - d / 100));
};

const getStripeClient = () => {
  if (!env.STRIPE_SECRET_KEY) throw new AppError('Stripe is not configured', HTTP_STATUS.INTERNAL_SERVER_ERROR);
  return new Stripe(env.STRIPE_SECRET_KEY, { apiVersion: '2026-06-24.dahlia' as any });
};

export const createPaymentIntent = asyncHandler(async (req: RequestWithUser, res: Response): Promise<void> => {
  if (!req.user) throw new AppError('Not authenticated', HTTP_STATUS.UNAUTHORIZED);

  const { deliveryAddressId, shippingMethod = 'standard', selectedProductIds, voucherCode } = req.body as {
    deliveryAddressId: string;
    shippingMethod?: 'standard' | 'express' | 'overnight';
    selectedProductIds?: string[];
    voucherCode?: string;
  };

  const shippingAmount = SHIPPING_AMOUNTS[shippingMethod] ?? 0;
  const selectedProductIdSet = new Set(selectedProductIds ?? []);

  const [address, cart] = await Promise.all([
    DeliveryAddress.findOne({ _id: deliveryAddressId, userId: req.user._id }),
    Cart.findOne({ userId: req.user._id }).populate('items.productId'),
  ]);

  if (!address) throw new AppError('Delivery address not found', HTTP_STATUS.NOT_FOUND);
  if (!cart || cart.items.length === 0) throw new AppError('Cart is empty', HTTP_STATUS.BAD_REQUEST);

  const selectedItems = selectedProductIdSet.size
    ? cart.items.filter((item) => selectedProductIdSet.has(item.productId._id.toString()))
    : cart.items;

  if (selectedItems.length === 0) throw new AppError('Selected cart items not found', HTTP_STATUS.BAD_REQUEST);

  const subtotal = roundMoney(
    selectedItems.reduce((sum, item) => sum + getProductMrp(item.productId as unknown as CartProduct) * item.quantity, 0)
  );
  const productDiscountAmount = roundMoney(
    selectedItems.reduce((sum, item) => {
      const p = item.productId as unknown as CartProduct;
      return sum + Math.max(0, getProductMrp(p) - p.price) * item.quantity;
    }, 0)
  );

  let voucherDiscountAmount = 0;
  if (voucherCode) {
    const voucher = await Voucher.findOne({ code: voucherCode.toUpperCase(), active: true });
    if (!voucher) throw new AppError('Invalid voucher code', HTTP_STATUS.BAD_REQUEST);
    if (voucher.expiresAt && new Date() > voucher.expiresAt) throw new AppError('Voucher expired', HTTP_STATUS.BAD_REQUEST);
    if (voucher.usageLimit && voucher.usedCount >= voucher.usageLimit) throw new AppError('Voucher usage limit reached', HTTP_STATUS.BAD_REQUEST);
    if (voucher.minOrderValue && subtotal < voucher.minOrderValue) throw new AppError('Order does not meet minimum voucher value', HTTP_STATUS.BAD_REQUEST);
    if (voucher.type === 'percentage') {
      voucherDiscountAmount = Math.round(((voucher.amount ?? 0) * (subtotal - productDiscountAmount)) / 100 * 100) / 100;
    } else if (voucher.type === 'fixed') {
      voucherDiscountAmount = Math.min(voucher.amount ?? 0, subtotal - productDiscountAmount);
    }
  }

  const discountAmount = roundMoney(productDiscountAmount + Math.max(0, Math.min(voucherDiscountAmount, subtotal - productDiscountAmount)));
  const taxAmount = roundMoney(subtotal * CART_TAX_RATE);
  const totalAmount = roundMoney(Math.max(0, subtotal - discountAmount) + shippingAmount + taxAmount);

  // Stripe NPR amount is in paisa (1 NPR = 100 paisa)
  const stripeAmount = Math.round(totalAmount * 100);
  if (stripeAmount < 1000) throw new AppError('Order total is below the minimum charge amount (NPR 10)', HTTP_STATUS.BAD_REQUEST);

  const stripe = getStripeClient();
  const paymentIntent = await stripe.paymentIntents.create({
    amount: stripeAmount,
    currency: 'npr',
    metadata: {
      userId: req.user._id.toString(),
      deliveryAddressId,
      shippingMethod,
    },
  });

  return sendSuccess(res, 'Payment intent created', {
    clientSecret: paymentIntent.client_secret,
    paymentIntentId: paymentIntent.id,
  }, HTTP_STATUS.OK) as any;
});

export const stripeWebhook = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const sig = req.headers['stripe-signature'] as string | undefined;
  if (!sig || !env.STRIPE_WEBHOOK_SECRET) {
    res.status(HTTP_STATUS.BAD_REQUEST).json({ error: 'Missing stripe-signature or webhook secret' });
    return;
  }

  let event: Stripe.Event;
  try {
    const stripe = getStripeClient();
    event = stripe.webhooks.constructEvent(req.body as Buffer, sig, env.STRIPE_WEBHOOK_SECRET);
  } catch {
    res.status(HTTP_STATUS.BAD_REQUEST).json({ error: 'Invalid webhook signature' });
    return;
  }

  if (event.type === 'payment_intent.succeeded') {
    const pi = event.data.object as Stripe.PaymentIntent;
    await Order.findOneAndUpdate(
      { stripePaymentIntentId: pi.id },
      { paymentStatus: PaymentStatus.COMPLETED, paidAt: new Date() }
    );
  } else if (event.type === 'payment_intent.payment_failed') {
    const pi = event.data.object as Stripe.PaymentIntent;
    await Order.findOneAndUpdate(
      { stripePaymentIntentId: pi.id },
      { paymentStatus: PaymentStatus.FAILED }
    );
  }

  res.json({ received: true });
});
