import Stripe from 'stripe';
import PDFDocument from 'pdfkit';
import { Request, Response } from 'express';
import { Types } from 'mongoose';
import { asyncHandler } from '../utils/asyncHandler';
import { sendSuccess } from '../utils/apiResponse';
import { HTTP_STATUS } from '../constants/app.constants';
import { AppError } from '../utils/appError';
import { RequestWithUser } from '../middlewares/auth';
import Cart from '../models/Cart';
import Product from '../models/Product';
import Order from '../models/Order';
import DeliveryAddress from '../models/DeliveryAddress';
import Voucher from '../models/Voucher';
import User from '../models/User';
import env from '../config/env';
import {
  sendOrderCancelledEmail,
  sendOrderConfirmationEmail,
  sendOrderDeliveredEmail,
  sendOrderShippedEmail,
} from '../services/emailService';
import { OrderStatus, PaymentStatus } from '../types/index';
import { AdminOrderListQueryRequest, PlaceOrderRequest, UpdateOrderStatusRequest } from '../validations/order.validation';
import {
  calculateEstimatedDeliveryDate,
  buildDeliveryTimeline,
  getDaysUntilDelivery,
} from '../utils/deliveryUtils';

type CartProduct = {
  _id: string;
  price: number;
  discountPercentage?: number;
  stock: number;
  name: string;
  category: string;
};

const CART_TAX_RATE = 0.02;
const SHIPPING_AMOUNTS = {
  standard: 0,
  express: 29,
  overnight: 79,
} as const;
const roundMoney = (value: number) => Math.round(value * 100) / 100;

const getProductMrp = (product: CartProduct) => {
  const discount = product.discountPercentage ?? 0;

  if (discount <= 0 || discount >= 100) {
    return product.price;
  }

  return roundMoney(product.price / (1 - discount / 100));
};

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const expandAdminOrderStatuses = (statuses?: AdminOrderListQueryRequest['status']) => {
  if (!statuses?.length || statuses.includes('all')) {
    return [];
  }

  return statuses.flatMap((status) => {
    if (status === 'processing') {
      return [OrderStatus.CONFIRMED, OrderStatus.SHIPPED];
    }

    return [status as OrderStatus];
  });
};

const placeOrder = asyncHandler(async (req: RequestWithUser, res: Response): Promise<void> => {
  if (!req.user) {
    throw new AppError('Not authenticated', HTTP_STATUS.UNAUTHORIZED);
  }

  const { deliveryAddressId, paymentMethod, notes, voucherCode, shippingMethod = 'standard', selectedProductIds, estimatedDeliveryDate, stripePaymentIntentId } = req.body as PlaceOrderRequest & { estimatedDeliveryDate?: string; stripePaymentIntentId?: string };
  const shippingAmount = SHIPPING_AMOUNTS[shippingMethod];
  const selectedProductIdSet = new Set(selectedProductIds ?? []);

  const address = await DeliveryAddress.findOne({ _id: deliveryAddressId, userId: req.user._id });
  if (!address) {
    throw new AppError('Delivery address not found', HTTP_STATUS.NOT_FOUND);
  }

  const cart = await Cart.findOne({ userId: req.user._id }).populate('items.productId');
  if (!cart || cart.items.length === 0) {
    throw new AppError('Cart is empty', HTTP_STATUS.BAD_REQUEST);
  }

  const selectedCartItems = selectedProductIdSet.size
    ? cart.items.filter((item) => selectedProductIdSet.has(item.productId._id.toString()))
    : cart.items;

  if (selectedCartItems.length === 0) {
    throw new AppError('Selected cart items were not found', HTTP_STATUS.BAD_REQUEST);
  }

  const items = selectedCartItems.map((item) => {
    const product = item.productId as unknown as CartProduct;
    return {
      productId: product._id,
      productName: product.name,
      quantity: item.quantity,
      unitPrice: product.price,
      lineTotal: Math.round(item.quantity * product.price * 100) / 100,
    };
  });

  const subtotal = roundMoney(
    selectedCartItems.reduce((sum, item) => {
      const product = item.productId as unknown as CartProduct;
      return sum + getProductMrp(product) * item.quantity;
    }, 0)
  );
  const productDiscountAmount = roundMoney(
    selectedCartItems.reduce((sum, item) => {
      const product = item.productId as unknown as CartProduct;
      return sum + Math.max(0, getProductMrp(product) - product.price) * item.quantity;
    }, 0)
  );

  let voucherDiscountAmount = 0;
  let appliedVoucherCode: string | undefined;

  if (voucherCode) {
    const voucher = await Voucher.findOne({ code: voucherCode.toUpperCase(), active: true });
    if (!voucher) {
      throw new AppError('Invalid voucher code', HTTP_STATUS.BAD_REQUEST);
    }

    if (voucher.expiresAt && new Date() > voucher.expiresAt) {
      throw new AppError('Voucher expired', HTTP_STATUS.BAD_REQUEST);
    }

    if (voucher.usageLimit && voucher.usedCount >= voucher.usageLimit) {
      throw new AppError('Voucher usage limit reached', HTTP_STATUS.BAD_REQUEST);
    }

    if (voucher.minOrderValue && subtotal < voucher.minOrderValue) {
      throw new AppError('Order does not meet minimum value for this voucher', HTTP_STATUS.BAD_REQUEST);
    }

    if (voucher.type === 'percentage') {
      voucherDiscountAmount = Math.round(((voucher.amount ?? 0) * (subtotal - productDiscountAmount)) / 100 * 100) / 100;
    } else if (voucher.type === 'fixed') {
      voucherDiscountAmount = Math.min(voucher.amount ?? 0, subtotal - productDiscountAmount);
    } else if (voucher.type === 'bundle') {
      const bundle = voucher.bundle;
      const bundleIds = bundle?.productIds?.map((id) => id.toString()) ?? [];
      if (bundleIds.length === 0) {
        throw new AppError('Invalid bundle voucher configuration', HTTP_STATUS.INTERNAL_SERVER_ERROR);
      }

      const matchedItems = items.filter((item) => bundleIds.includes(item.productId.toString()));
      if (matchedItems.length < bundleIds.length) {
        throw new AppError('Cart does not contain required products for this bundle voucher', HTTP_STATUS.BAD_REQUEST);
      }

      const bundleSubtotal = Math.round(matchedItems.reduce((sum, item) => sum + item.lineTotal, 0) * 100) / 100;
      if (!bundle) {
        throw new AppError('Invalid bundle voucher configuration', HTTP_STATUS.INTERNAL_SERVER_ERROR);
      }

      if (bundle.discountPercentage !== undefined) {
        voucherDiscountAmount = Math.round((bundleSubtotal * bundle.discountPercentage) / 100 * 100) / 100;
      } else if (bundle.discountAmount !== undefined) {
        voucherDiscountAmount = Math.min(bundle.discountAmount, bundleSubtotal);
      }
    }

    appliedVoucherCode = voucher.code;
    voucher.usedCount += 1;
    await voucher.save();
  }

  voucherDiscountAmount = Math.max(0, Math.min(voucherDiscountAmount, subtotal - productDiscountAmount));
  const discountAmount = roundMoney(productDiscountAmount + voucherDiscountAmount);
  const taxAmount = roundMoney(subtotal * CART_TAX_RATE);
  const totalAmount = roundMoney(Math.max(0, subtotal - discountAmount) + shippingAmount + taxAmount);

  for (const item of selectedCartItems) {
    const product = item.productId as unknown as CartProduct;
    if (product.stock < item.quantity) {
      throw new AppError(`Insufficient stock for ${product.name}`, HTTP_STATUS.BAD_REQUEST);
    }
  }

  // Verify Stripe payment before decrementing stock
  if (paymentMethod === 'card') {
    if (!stripePaymentIntentId) throw new AppError('Stripe payment intent ID is required for card payments', HTTP_STATUS.BAD_REQUEST);
    if (!env.STRIPE_SECRET_KEY) throw new AppError('Stripe is not configured', HTTP_STATUS.INTERNAL_SERVER_ERROR);

    const existingOrder = await Order.findOne({ stripePaymentIntentId });
    if (existingOrder) throw new AppError('This payment has already been used to place an order', HTTP_STATUS.CONFLICT);

    const stripe = new Stripe(env.STRIPE_SECRET_KEY, { apiVersion: '2026-06-24.dahlia' as any });
    const pi = await stripe.paymentIntents.retrieve(stripePaymentIntentId);
    if (pi.status !== 'succeeded') throw new AppError('Card payment has not been completed', HTTP_STATUS.BAD_REQUEST);

    const expectedAmount = Math.round(totalAmount * 100);
    if (pi.amount !== expectedAmount) throw new AppError('Payment amount does not match order total', HTTP_STATUS.BAD_REQUEST);
  }

  for (const item of selectedCartItems) {
    const product = item.productId as unknown as CartProduct;
    await Product.findByIdAndUpdate(product._id, { $inc: { stock: -item.quantity } });
  }

  const isCardPayment = paymentMethod === 'card';

  const order = await Order.create({
    userId: req.user._id,
    items,
    deliveryAddressId,
    paymentMethod,
    paymentStatus: isCardPayment ? PaymentStatus.COMPLETED : PaymentStatus.PENDING,
    status: OrderStatus.PENDING,
    voucherCode: appliedVoucherCode,
    subtotal,
    discountAmount,
    shippingMethod,
    shippingAmount,
    taxAmount,
    totalAmount,
    notes,
    estimatedDeliveryDate: estimatedDeliveryDate ? new Date(estimatedDeliveryDate) : undefined,
    stripePaymentIntentId: isCardPayment ? stripePaymentIntentId : undefined,
    paidAt: isCardPayment ? new Date() : undefined,
  });

  const orderedProductIds = new Set(items.map((item) => item.productId.toString()));
  cart.items = cart.items.filter((item) => !orderedProductIds.has(item.productId._id.toString()));
  await cart.save();

  // send confirmation email (do not fail the request if email sending fails)
  try {
    if (req.user && req.user.email) {
      await sendOrderConfirmationEmail(req.user.email, order);
    }
  } catch (err) {
    console.error('Failed to send order confirmation email', err);
  }

  return sendSuccess(
    res,
    'Order placed successfully',
    { order },
    HTTP_STATUS.CREATED
  ) as any;
});

const getOrder = asyncHandler(async (req: RequestWithUser, res: Response): Promise<void> => {
  if (!req.user) {
    throw new AppError('Not authenticated', HTTP_STATUS.UNAUTHORIZED);
  }

  const { orderId } = req.params;
  const order = await Order.findOne({ _id: orderId, userId: req.user._id }).populate('items.productId').populate('deliveryAddressId');

  if (!order) {
    throw new AppError('Order not found', HTTP_STATUS.NOT_FOUND);
  }

  return sendSuccess(res, 'Order fetched successfully', { order }, HTTP_STATUS.OK) as any;
});

const getMyOrders = asyncHandler(async (req: RequestWithUser, res: Response): Promise<void> => {
  if (!req.user) {
    throw new AppError('Not authenticated', HTTP_STATUS.UNAUTHORIZED);
  }

  const orders = await Order.find({ userId: req.user._id })
    .populate('items.productId', 'name price category brand images stock verifiedBadge')
    .populate('deliveryAddressId')
    .sort({ createdAt: -1 });

  return sendSuccess(res, 'Orders fetched successfully', { orders }, HTTP_STATUS.OK) as any;
});

const getAllOrders = asyncHandler(async (req: RequestWithUser, res: Response): Promise<void> => {
  if (!req.user) {
    throw new AppError('Not authenticated', HTTP_STATUS.UNAUTHORIZED);
  }

  const { status, search, page = 1, limit = 20 } = req.query as unknown as AdminOrderListQueryRequest;
  const filter: Record<string, unknown> = {};
  const statuses = expandAdminOrderStatuses(status);

  if (statuses.length) {
    filter.status = { $in: [...new Set(statuses)] };
  }

  if (search?.trim()) {
    const searchTerm = search.trim();
    const regex = new RegExp(escapeRegExp(searchTerm), 'i');
    const orFilters: Record<string, unknown>[] = [
      { 'items.productName': regex },
      { notes: regex },
      { voucherCode: regex },
    ];

    if (Types.ObjectId.isValid(searchTerm)) {
      orFilters.push({ _id: new Types.ObjectId(searchTerm) });
    }

    const [matchingUsers, matchingAddresses] = await Promise.all([
      User.find({
        $or: [
          { firstName: regex },
          { lastName: regex },
          { email: regex },
          { phone: regex },
        ],
      }).select('_id'),
      DeliveryAddress.find({
        $or: [
          { recipientName: regex },
          { phone: regex },
          { street: regex },
          { city: regex },
          { state: regex },
          { postalCode: regex },
          { country: regex },
        ],
      }).select('_id'),
    ]);

    if (matchingUsers.length) {
      orFilters.push({ userId: { $in: matchingUsers.map((user) => user._id) } });
    }

    if (matchingAddresses.length) {
      orFilters.push({ deliveryAddressId: { $in: matchingAddresses.map((address) => address._id) } });
    }

    filter.$or = orFilters;
  }

  const skip = (page - 1) * limit;
  const [orders, total] = await Promise.all([
    Order.find(filter)
      .populate('userId', 'firstName lastName email phone')
      .populate('deliveryAddressId')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit),
    Order.countDocuments(filter),
  ]);

  return sendSuccess(
    res,
    'Orders fetched successfully',
    {
      orders,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
        hasNextPage: page * limit < total,
        hasPrevPage: page > 1,
      },
    },
    HTTP_STATUS.OK
  ) as any;
});

const getAdminOrder = asyncHandler(async (req: RequestWithUser, res: Response): Promise<void> => {
  if (!req.user) {
    throw new AppError('Not authenticated', HTTP_STATUS.UNAUTHORIZED);
  }

  const { orderId } = req.params;
  const order = await Order.findById(orderId)
    .populate('userId', 'firstName lastName email phone')
    .populate('deliveryAddressId')
    .populate('items.productId', 'name price category brand images stock verifiedBadge');

  if (!order) {
    throw new AppError('Order not found', HTTP_STATUS.NOT_FOUND);
  }

  return sendSuccess(res, 'Order fetched successfully', { order }, HTTP_STATUS.OK) as any;
});

const trackOrder = asyncHandler(async (req: RequestWithUser, res: Response): Promise<void> => {
  if (!req.user) {
    throw new AppError('Not authenticated', HTTP_STATUS.UNAUTHORIZED);
  }

  const { orderId } = req.params;
  const order = await Order.findOne({ _id: orderId, userId: req.user._id });

  if (!order) {
    throw new AppError('Order not found', HTTP_STATUS.NOT_FOUND);
  }

  // Build delivery timeline
  const timeline = buildDeliveryTimeline(
    order.createdAt,
    order.status,
    new Date(order.updatedAt),
    order.status === OrderStatus.SHIPPED ? new Date(order.updatedAt) : undefined,
    order.deliveredAt
  );

  // Calculate days remaining until delivery
  let daysUntilDelivery = null;
  if (order.estimatedDeliveryDate && order.status !== OrderStatus.DELIVERED && order.status !== OrderStatus.CANCELLED) {
    daysUntilDelivery = getDaysUntilDelivery(order.estimatedDeliveryDate);
  }

  const tracking = {
    orderId: order._id,
    status: order.status,
    paymentStatus: order.paymentStatus,
    placedAt: order.createdAt,
    lastUpdated: order.updatedAt,
    estimatedDeliveryDate: order.estimatedDeliveryDate ?? null,
    daysUntilDelivery,
    deliveredAt: order.deliveredAt ?? null,
    cancelledAt: order.cancelledAt ?? null,
    timeline,
  };

  return sendSuccess(res, 'Order tracking', { tracking }, HTTP_STATUS.OK) as any;
});

const cancelOrder = asyncHandler(async (req: RequestWithUser, res: Response): Promise<void> => {
  if (!req.user) {
    throw new AppError('Not authenticated', HTTP_STATUS.UNAUTHORIZED);
  }

  const { orderId } = req.params;
  const { reason } = req.body as { reason?: string };

  const order = await Order.findOne({ _id: orderId, userId: req.user._id });
  if (!order) {
    throw new AppError('Order not found', HTTP_STATUS.NOT_FOUND);
  }

  // For delivered orders, allow return requests
  if (order.status === OrderStatus.DELIVERED) {
    order.status = OrderStatus.RETURNED;
    order.cancellationReason = reason;
    await order.save();
    return sendSuccess(res, 'Return request submitted successfully', { order }, HTTP_STATUS.OK) as any;
  }

  if (![OrderStatus.PENDING, OrderStatus.CONFIRMED].includes(order.status)) {
    throw new AppError('Order cannot be cancelled at this stage', HTTP_STATUS.BAD_REQUEST);
  }

  order.status = OrderStatus.CANCELLED;
  order.paymentStatus = PaymentStatus.REFUNDED;
  order.cancellationReason = reason;
  order.cancelledAt = new Date();
  await order.save();

  for (const item of order.items) {
    await Product.findByIdAndUpdate(item.productId, { $inc: { stock: item.quantity } });
  }

  try {
    if (req.user.email) {
      await sendOrderCancelledEmail(req.user.email, order);
    }
  } catch (emailError) {
    console.error('Failed to send order cancellation email', emailError);
  }

  return sendSuccess(res, 'Order cancelled successfully', { order }, HTTP_STATUS.OK) as any;
});

const updateOrderStatus = asyncHandler(async (req: RequestWithUser, res: Response): Promise<void> => {
  if (!req.user) {
    throw new AppError('Not authenticated', HTTP_STATUS.UNAUTHORIZED);
  }

  const { orderId } = req.params;
  const { status } = req.body as UpdateOrderStatusRequest;

  const order = await Order.findById(orderId);
  if (!order) {
    throw new AppError('Order not found', HTTP_STATUS.NOT_FOUND);
  }

  // Validate status transitions
  const validTransitions: Record<OrderStatus, OrderStatus[]> = {
    [OrderStatus.PENDING]: [OrderStatus.CONFIRMED],
    [OrderStatus.CONFIRMED]: [OrderStatus.SHIPPED],
    [OrderStatus.SHIPPED]: [OrderStatus.DELIVERED],
    [OrderStatus.DELIVERED]: [],
    [OrderStatus.CANCELLED]: [],
    [OrderStatus.RETURNED]: [],
  };

  if (!validTransitions[order.status].includes(status)) {
    throw new AppError(
      `Cannot transition from ${order.status} to ${status}`,
      HTTP_STATUS.BAD_REQUEST
    );
  }

  // Update status
  order.status = status;

  // Calculate estimated delivery date when order is confirmed
  if (status === OrderStatus.CONFIRMED && !order.estimatedDeliveryDate) {
    order.estimatedDeliveryDate = calculateEstimatedDeliveryDate(order.createdAt, status);
  }

  // Mark as delivered
  if (status === OrderStatus.DELIVERED) {
    order.deliveredAt = new Date();
  }

  await order.save();

  if ([OrderStatus.SHIPPED, OrderStatus.DELIVERED].includes(status)) {
    try {
      const customer = await User.findById(order.userId).select('email');

      if (customer?.email) {
        if (status === OrderStatus.SHIPPED) {
          await sendOrderShippedEmail(customer.email, order);
        } else if (status === OrderStatus.DELIVERED) {
          await sendOrderDeliveredEmail(customer.email, order);
        }
      }
    } catch (emailError) {
      console.error(`Failed to send order ${status} email`, emailError);
    }
  }

  const timeline = buildDeliveryTimeline(
    order.createdAt,
    order.status,
    new Date(order.updatedAt),
    order.status === OrderStatus.SHIPPED ? new Date(order.updatedAt) : undefined,
    order.deliveredAt
  );

  const response = {
    order,
    timeline,
    message: `Order status updated to ${status}`,
  };

  return sendSuccess(res, `Order status updated to ${status}`, response, HTTP_STATUS.OK) as any;
});

const updatePaymentStatus = asyncHandler(async (req: RequestWithUser, res: Response): Promise<void> => {
  if (!req.user) throw new AppError('Not authenticated', HTTP_STATUS.UNAUTHORIZED);

  const { orderId } = req.params;
  const { paymentStatus } = req.body as { paymentStatus?: string };

  const allowedStatuses = Object.values(PaymentStatus);
  if (!paymentStatus || !allowedStatuses.includes(paymentStatus as PaymentStatus)) {
    throw new AppError(`paymentStatus must be one of: ${allowedStatuses.join(', ')}`, HTTP_STATUS.BAD_REQUEST);
  }

  const order = await Order.findById(orderId);
  if (!order) throw new AppError('Order not found', HTTP_STATUS.NOT_FOUND);

  order.paymentStatus = paymentStatus as PaymentStatus;
  if (paymentStatus === PaymentStatus.COMPLETED && !order.paidAt) {
    order.paidAt = new Date();
  }
  await order.save();

  return sendSuccess(res, 'Payment status updated', { order }, HTTP_STATUS.OK) as any;
});

const downloadInvoice = asyncHandler(async (req: RequestWithUser, res: Response): Promise<void> => {
  if (!req.user) {
    throw new AppError('Not authenticated', HTTP_STATUS.UNAUTHORIZED);
  }

  const { orderId } = req.params;
  const order = await Order.findOne({ _id: orderId, userId: req.user._id }).populate('deliveryAddressId');

  if (!order) {
    throw new AppError('Order not found', HTTP_STATUS.NOT_FOUND);
  }

  const invoiceNumber = `INV-${order._id.toString().substring(0, 8).toUpperCase()}-${order.createdAt.getFullYear()}`;
  const address = order.deliveryAddressId as unknown as {
    recipientName?: string; street?: string; city?: string; state?: string; postalCode?: string; country?: string;
  } | null;

  const fmt = (n: number) => `NPR ${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const dateStr = order.createdAt.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

  const doc = new PDFDocument({ margin: 50, size: 'A4' });

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="invoice-${invoiceNumber}.pdf"`);
  doc.pipe(res);

  // ---- Header ----------------------------------------------------------------
  doc.fontSize(24).font('Helvetica-Bold').text('FitFIXto', 50, 50);
  doc.fontSize(10).font('Helvetica').fillColor('#666666')
    .text('Fitness & Wellness Marketplace', 50, 78)
    .text('support@fitfixto.com', 50, 90);

  doc.fontSize(22).font('Helvetica-Bold').fillColor('#111111')
    .text('INVOICE', 400, 50, { align: 'right' });
  doc.fontSize(10).font('Helvetica').fillColor('#444444')
    .text(`Invoice #: ${invoiceNumber}`, 400, 78, { align: 'right' })
    .text(`Date: ${dateStr}`, 400, 90, { align: 'right' })
    .text(`Order #: ${order._id.toString().substring(0, 12).toUpperCase()}`, 400, 102, { align: 'right' });

  doc.moveTo(50, 120).lineTo(545, 120).strokeColor('#e5e7eb').stroke();

  // ---- Status badges ---------------------------------------------------------
  const payStatusColor = order.paymentStatus === 'completed' ? '#15803d' : order.paymentStatus === 'failed' ? '#dc2626' : '#d97706';
  doc.roundedRect(50, 132, 100, 20, 4).fill(payStatusColor);
  doc.fontSize(9).font('Helvetica-Bold').fillColor('#ffffff')
    .text(`Payment: ${order.paymentStatus.toUpperCase()}`, 52, 137, { width: 96, align: 'center' });

  const orderStatusColor = order.status === 'delivered' ? '#15803d' : order.status === 'cancelled' ? '#dc2626' : '#2563eb';
  doc.roundedRect(160, 132, 100, 20, 4).fill(orderStatusColor);
  doc.fontSize(9).font('Helvetica-Bold').fillColor('#ffffff')
    .text(`Order: ${order.status.toUpperCase()}`, 162, 137, { width: 96, align: 'center' });

  // ---- Bill to ---------------------------------------------------------------
  doc.fontSize(11).font('Helvetica-Bold').fillColor('#111111').text('Bill To:', 50, 168);
  doc.fontSize(10).font('Helvetica').fillColor('#444444');
  if (address?.recipientName) doc.text(address.recipientName, 50, 182);
  if (address?.street) doc.text(address.street, 50, doc.y);
  if (address?.city) doc.text(`${address.city}${address.state ? ', ' + address.state : ''}${address.postalCode ? ' ' + address.postalCode : ''}`, 50, doc.y);
  if (address?.country) doc.text(address.country, 50, doc.y);

  // ---- Payment info ----------------------------------------------------------
  doc.fontSize(11).font('Helvetica-Bold').fillColor('#111111').text('Payment Method:', 350, 168);
  doc.fontSize(10).font('Helvetica').fillColor('#444444')
    .text(order.paymentMethod.replace(/_/g, ' ').toUpperCase(), 350, 182);
  if (order.paidAt) {
    doc.text(`Paid: ${order.paidAt.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}`, 350, doc.y);
  }

  // ---- Items table -----------------------------------------------------------
  const tableTop = Math.max(doc.y, 260) + 16;
  doc.rect(50, tableTop, 495, 22).fill('#f3f4f6');
  doc.fontSize(10).font('Helvetica-Bold').fillColor('#111111')
    .text('Item', 58, tableTop + 6)
    .text('Qty', 350, tableTop + 6, { width: 50, align: 'center' })
    .text('Unit Price', 400, tableTop + 6, { width: 75, align: 'right' })
    .text('Total', 475, tableTop + 6, { width: 65, align: 'right' });

  let rowY = tableTop + 26;
  doc.font('Helvetica').fillColor('#333333');

  for (const item of order.items) {
    if (rowY > 700) { doc.addPage(); rowY = 50; }
    doc.fontSize(10)
      .text(item.productName, 58, rowY, { width: 280 })
      .text(String(item.quantity), 350, rowY, { width: 50, align: 'center' })
      .text(fmt(item.unitPrice), 400, rowY, { width: 75, align: 'right' })
      .text(fmt(item.lineTotal), 475, rowY, { width: 65, align: 'right' });
    rowY += 20;
    doc.moveTo(50, rowY - 2).lineTo(545, rowY - 2).strokeColor('#f3f4f6').stroke();
  }

  // ---- Totals ----------------------------------------------------------------
  rowY += 10;
  doc.moveTo(350, rowY).lineTo(545, rowY).strokeColor('#e5e7eb').stroke();
  rowY += 8;

  const addTotalRow = (label: string, value: string, bold = false) => {
    doc.fontSize(10)
      .font(bold ? 'Helvetica-Bold' : 'Helvetica')
      .fillColor(bold ? '#111111' : '#444444')
      .text(label, 350, rowY, { width: 125, align: 'right' })
      .text(value, 475, rowY, { width: 65, align: 'right' });
    rowY += 18;
  };

  addTotalRow('Subtotal:', fmt(order.subtotal));
  if (order.discountAmount > 0) addTotalRow(`Discount${order.voucherCode ? ` (${order.voucherCode})` : ''}:`, `-${fmt(order.discountAmount)}`);
  if (order.shippingAmount > 0) addTotalRow(`Shipping (${order.shippingMethod || 'standard'}):`, fmt(order.shippingAmount));
  addTotalRow('Tax (2%):', fmt(order.taxAmount));
  doc.moveTo(350, rowY).lineTo(545, rowY).strokeColor('#111111').stroke();
  rowY += 6;
  addTotalRow('TOTAL:', fmt(order.totalAmount), true);

  // ---- Footer ----------------------------------------------------------------
  doc.fontSize(9).font('Helvetica').fillColor('#9ca3af')
    .text('Thank you for shopping with FitFIXto!', 50, 760, { align: 'center', width: 495 })
    .text(`Generated on ${new Date().toLocaleString('en-US')}`, 50, 772, { align: 'center', width: 495 });

  doc.end();
});

export { placeOrder, getOrder, getAdminOrder, getMyOrders, getAllOrders, cancelOrder, trackOrder, updateOrderStatus, updatePaymentStatus, downloadInvoice };
