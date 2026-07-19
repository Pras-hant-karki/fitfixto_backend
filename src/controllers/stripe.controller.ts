import Stripe from 'stripe';
import { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import { sendSuccess } from '../utils/apiResponse';
import { HTTP_STATUS } from '../constants/app.constants';
import { AppError } from '../utils/appError';
import { RequestWithUser } from '../middlewares/auth';
import Cart from '../models/Cart';
import Order from '../models/Order';
import Product from '../models/Product';
import DeliveryAddress from '../models/DeliveryAddress';
import Voucher from '../models/Voucher';
import User from '../models/User';
import env from '../config/env';
import { OrderStatus, PaymentMethod, PaymentStatus } from '../types/index';
import { sendOrderConfirmationEmail } from '../services/emailService';

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

// Shared helper: cancel a stale pending order and restore its reserved stock.
// Called from the idempotency check above and from the cron cleanup endpoint.
export const cancelStalePendingOrder = async (order: import('../models/Order').IOrder) => {
  order.paymentStatus = PaymentStatus.FAILED;
  order.status = OrderStatus.CANCELLED;
  order.cancellationReason = 'Stripe checkout session expired without payment';
  order.cancelledAt = new Date();
  await order.save();
  for (const item of order.items) {
    await Product.findByIdAndUpdate(item.productId, { $inc: { stock: item.quantity } });
  }
};

// ---------------------------------------------------------------------------
// Stripe Payment Intent — used by the card / Elements flow on checkout page
// ---------------------------------------------------------------------------
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

// ---------------------------------------------------------------------------
// Stripe Checkout Session — redirect-to-Stripe hosted payment page
//
// Flow:
//   1. Validate cart, address, stock
//   2. Decrement stock to reserve inventory
//   3. Clear selected items from cart
//   4. Create Order (status=PENDING, paymentStatus=PENDING)
//   5. Create Stripe Checkout Session with orderId in metadata + success_url
//   6. Attach stripeSessionId to the order (single atomic update)
//   7. Return { url, sessionId, orderId }
//
//   Webhook checkout.session.completed → marks order COMPLETED, sends email
//   Webhook checkout.session.expired   → cancels order, restores stock
// ---------------------------------------------------------------------------
export const createCheckoutSession = asyncHandler(async (req: RequestWithUser, res: Response): Promise<void> => {
  if (!req.user) throw new AppError('Not authenticated', HTTP_STATUS.UNAUTHORIZED);

  const { deliveryAddressId, shippingMethod = 'standard', selectedProductIds, voucherCode, estimatedDeliveryDate } = req.body as {
    deliveryAddressId: string;
    shippingMethod?: 'standard' | 'express' | 'overnight';
    selectedProductIds?: string[];
    voucherCode?: string;
    estimatedDeliveryDate?: string;
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

  // ---- Idempotency: reuse an existing valid Stripe session for this user ---
  // Prevents duplicate orders from rapid double-submits or direct API calls.
  const STRIPE_SESSION_LIFETIME_MS = 23 * 60 * 60 * 1000; // Stripe sessions last 24h; check within 23h
  const existingPendingOrder = await Order.findOne({
    userId: req.user._id,
    paymentMethod: PaymentMethod.CARD,
    paymentStatus: PaymentStatus.PENDING,
    stripeSessionId: { $exists: true, $ne: null },
    createdAt: { $gte: new Date(Date.now() - STRIPE_SESSION_LIFETIME_MS) },
  }).sort({ createdAt: -1 });

  if (existingPendingOrder?.stripeSessionId) {
    try {
      const stripeCheck = getStripeClient();
      const existingSession = await stripeCheck.checkout.sessions.retrieve(existingPendingOrder.stripeSessionId);

      if (existingSession.status === 'open' && existingSession.url) {
        // Valid session still open — redirect to it instead of creating a new one
        return sendSuccess(res, 'Resuming existing checkout session', {
          url: existingSession.url,
          sessionId: existingSession.id,
          orderId: existingPendingOrder._id,
        }, HTTP_STATUS.OK) as any;
      }

      // Session is no longer open — cancel the stale order and restore its stock
      // (webhook may have been missed; clean up defensively before creating a new one)
      await cancelStalePendingOrder(existingPendingOrder);
    } catch {
      // Stripe API unreachable — proceed to create a new session; stale order will
      // be caught by the cron cleanup job.
    }
  }

  // Stock check before any reservation
  for (const item of selectedItems) {
    const product = item.productId as unknown as CartProduct;
    if (product.stock < item.quantity) {
      throw new AppError(`Insufficient stock for ${product.name}`, HTTP_STATUS.BAD_REQUEST);
    }
  }

  // ---- Price calculation ------------------------------------------------
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
  let appliedVoucherCode: string | undefined;
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
    appliedVoucherCode = voucher.code;
    voucher.usedCount += 1;
    await voucher.save();
  }

  const discountAmount = roundMoney(productDiscountAmount + Math.max(0, Math.min(voucherDiscountAmount, subtotal - productDiscountAmount)));
  const taxAmount = roundMoney(subtotal * CART_TAX_RATE);
  const totalAmount = roundMoney(Math.max(0, subtotal - discountAmount) + shippingAmount + taxAmount);
  const totalPaisa = Math.round(totalAmount * 100);

  if (totalPaisa < 1000) throw new AppError('Order total is below the minimum charge amount (NPR 10)', HTTP_STATUS.BAD_REQUEST);

  // ---- Build order items -------------------------------------------------
  const orderItems = selectedItems.map((item) => {
    const product = item.productId as unknown as CartProduct;
    return {
      productId: product._id,
      productName: product.name,
      quantity: item.quantity,
      unitPrice: product.price,
      lineTotal: roundMoney(item.quantity * product.price),
    };
  });

  // ---- Reserve stock -----------------------------------------------------
  for (const item of selectedItems) {
    const product = item.productId as unknown as CartProduct;
    await Product.findByIdAndUpdate(product._id, { $inc: { stock: -item.quantity } });
  }

  // ---- Clear selected items from cart ------------------------------------
  const reservedIds = new Set(orderItems.map((i) => i.productId.toString()));
  cart.items = cart.items.filter((item) => !reservedIds.has(item.productId._id.toString()));
  await cart.save();

  // ---- Create PENDING order ----------------------------------------------
  const order = await Order.create({
    userId: req.user._id,
    items: orderItems,
    deliveryAddressId,
    paymentMethod: PaymentMethod.CARD,
    paymentStatus: PaymentStatus.PENDING,
    status: OrderStatus.PENDING,
    voucherCode: appliedVoucherCode,
    subtotal,
    discountAmount,
    shippingMethod,
    shippingAmount,
    taxAmount,
    totalAmount,
    estimatedDeliveryDate: estimatedDeliveryDate ? new Date(estimatedDeliveryDate) : undefined,
  });

  // ---- Create Stripe Checkout Session ------------------------------------
  const stripe = getStripeClient();

  const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = selectedItems.map((item) => {
    const product = item.productId as unknown as CartProduct;
    return {
      price_data: {
        currency: 'npr',
        product_data: { name: product.name },
        unit_amount: Math.round(product.price * 100),
      },
      quantity: item.quantity,
    };
  });

  if (taxAmount > 0) {
    lineItems.push({
      price_data: { currency: 'npr', product_data: { name: 'Tax (2%)' }, unit_amount: Math.round(taxAmount * 100) },
      quantity: 1,
    });
  }

  if (shippingAmount > 0) {
    lineItems.push({
      price_data: { currency: 'npr', product_data: { name: `Shipping (${shippingMethod})` }, unit_amount: Math.round(shippingAmount * 100) },
      quantity: 1,
    });
  }

  const session = await stripe.checkout.sessions.create({
    payment_method_types: ['card'],
    line_items: lineItems,
    mode: 'payment',
    customer_email: req.user.email,
    success_url: `${env.FRONTEND_URL}/payment/success?session_id={CHECKOUT_SESSION_ID}&order_id=${order._id}`,
    cancel_url: `${env.FRONTEND_URL}/payment/cancel?order_id=${order._id}`,
    metadata: {
      orderId: order._id.toString(),
      userId: req.user._id.toString(),
    },
  });

  // ---- Attach session ID to order ----------------------------------------
  order.stripeSessionId = session.id;
  await order.save();

  return sendSuccess(res, 'Checkout session created', {
    url: session.url,
    sessionId: session.id,
    orderId: order._id,
  }, HTTP_STATUS.OK) as any;
});

// ---------------------------------------------------------------------------
// Stripe Webhook
// ---------------------------------------------------------------------------
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

  // ---- payment_intent.succeeded — used by the Elements / manual PI flow ---
  if (event.type === 'payment_intent.succeeded') {
    const pi = event.data.object as Stripe.PaymentIntent;
    await Order.findOneAndUpdate(
      { stripePaymentIntentId: pi.id, paymentStatus: { $ne: PaymentStatus.COMPLETED } },
      { paymentStatus: PaymentStatus.COMPLETED, paidAt: new Date() }
    );
  }

  // ---- payment_intent.payment_failed --------------------------------------
  else if (event.type === 'payment_intent.payment_failed') {
    const pi = event.data.object as Stripe.PaymentIntent;
    await Order.findOneAndUpdate(
      { stripePaymentIntentId: pi.id, paymentStatus: PaymentStatus.PENDING },
      { paymentStatus: PaymentStatus.FAILED }
    );
  }

  // ---- checkout.session.completed — Checkout redirect flow ----------------
  else if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session;

    if (session.payment_status === 'paid') {
      // Idempotency: only update once
      const order = await Order.findOneAndUpdate(
        { stripeSessionId: session.id, paymentStatus: PaymentStatus.PENDING },
        { paymentStatus: PaymentStatus.COMPLETED, paidAt: new Date() },
        { new: true }
      );

      if (order) {
        // Send confirmation email asynchronously (don't block webhook response)
        try {
          const customer = await User.findById(order.userId).select('email');
          if (customer?.email) {
            await sendOrderConfirmationEmail(customer.email, order);
          }
        } catch (err) {
          console.error('Failed to send order confirmation email after checkout', err);
        }
      }
    }
  }

  // ---- checkout.session.expired — user did not complete payment -----------
  else if (event.type === 'checkout.session.expired') {
    const session = event.data.object as Stripe.Checkout.Session;

    const order = await Order.findOneAndUpdate(
      { stripeSessionId: session.id, paymentStatus: PaymentStatus.PENDING },
      { paymentStatus: PaymentStatus.FAILED, status: OrderStatus.CANCELLED, cancelledAt: new Date(), cancellationReason: 'Stripe checkout session expired' },
      { new: true }
    );

    // Restore reserved stock
    if (order) {
      for (const item of order.items) {
        await Product.findByIdAndUpdate(item.productId, { $inc: { stock: item.quantity } });
      }
    }
  }

  res.json({ received: true });
});
