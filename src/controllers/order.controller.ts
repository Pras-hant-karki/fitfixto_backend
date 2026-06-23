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
import { sendOrderConfirmationEmail } from '../services/emailService';
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
  stock: number;
  name: string;
  category: string;
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

  const { deliveryAddressId, paymentMethod, notes, voucherCode } = req.body as PlaceOrderRequest;

  const address = await DeliveryAddress.findOne({ _id: deliveryAddressId, userId: req.user._id });
  if (!address) {
    throw new AppError('Delivery address not found', HTTP_STATUS.NOT_FOUND);
  }

  const cart = await Cart.findOne({ userId: req.user._id }).populate('items.productId');
  if (!cart || cart.items.length === 0) {
    throw new AppError('Cart is empty', HTTP_STATUS.BAD_REQUEST);
  }

  const items = cart.items.map((item) => {
    const product = item.productId as unknown as CartProduct;
    return {
      productId: product._id,
      productName: product.name,
      quantity: item.quantity,
      unitPrice: product.price,
      lineTotal: Math.round(item.quantity * product.price * 100) / 100,
    };
  });

  const subtotal = Math.round(items.reduce((sum, item) => sum + item.lineTotal, 0) * 100) / 100;

  let discountAmount = 0;
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
      discountAmount = Math.round(((voucher.amount ?? 0) * subtotal) / 100 * 100) / 100;
    } else if (voucher.type === 'fixed') {
      discountAmount = Math.min(voucher.amount ?? 0, subtotal);
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
        discountAmount = Math.round((bundleSubtotal * bundle.discountPercentage) / 100 * 100) / 100;
      } else if (bundle.discountAmount !== undefined) {
        discountAmount = Math.min(bundle.discountAmount, bundleSubtotal);
      }
    }

    appliedVoucherCode = voucher.code;
    voucher.usedCount += 1;
    await voucher.save();
  }

  discountAmount = Math.max(0, Math.min(discountAmount, subtotal));
  const totalAmount = Math.round((subtotal - discountAmount) * 100) / 100;

  for (const item of cart.items) {
    const product = item.productId as unknown as CartProduct;
    if (product.stock < item.quantity) {
      throw new AppError(`Insufficient stock for ${product.name}`, HTTP_STATUS.BAD_REQUEST);
    }
  }

  for (const item of cart.items) {
    const product = item.productId as unknown as CartProduct;
    await Product.findByIdAndUpdate(product._id, { $inc: { stock: -item.quantity } });
  }

  const order = await Order.create({
    userId: req.user._id,
    items,
    deliveryAddressId,
    paymentMethod,
    paymentStatus: paymentMethod === 'cash_on_delivery' ? PaymentStatus.PENDING : PaymentStatus.PENDING,
    status: OrderStatus.PENDING,
    voucherCode: appliedVoucherCode,
    subtotal,
    discountAmount,
    totalAmount,
    notes,
  });

  cart.items = [];
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
    order.status !== OrderStatus.PENDING ? new Date(order.updatedAt) : undefined,
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
    [OrderStatus.PENDING]: [OrderStatus.CONFIRMED, OrderStatus.CANCELLED],
    [OrderStatus.CONFIRMED]: [OrderStatus.SHIPPED, OrderStatus.CANCELLED],
    [OrderStatus.SHIPPED]: [OrderStatus.DELIVERED],
    [OrderStatus.DELIVERED]: [OrderStatus.RETURNED],
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

  const timeline = buildDeliveryTimeline(
    order.createdAt,
    order.status,
    order.status !== OrderStatus.PENDING ? new Date(order.updatedAt) : undefined,
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

const updatePaymentStatus = asyncHandler(async (_req: Request, res: Response): Promise<void> => {
  return sendSuccess(res, 'Not implemented', { message: 'Use payment integration later' }, HTTP_STATUS.OK) as any;
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

  // Mock invoice data placeholder
  const invoice = {
    invoiceNumber: `INV-${order._id.toString().substring(0, 8).toUpperCase()}-${order.createdAt.getFullYear()}`,
    invoiceDate: order.createdAt,
    orderId: order._id,
    orderDate: order.createdAt,
    status: order.status,
    paymentStatus: order.paymentStatus,
    items: order.items.map((item) => ({
      productId: item.productId,
      productName: item.productName,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      lineTotal: item.lineTotal,
    })),
    subtotal: order.subtotal,
    discountAmount: order.discountAmount,
    discountCode: order.voucherCode ?? null,
    totalAmount: order.totalAmount,
    deliveryAddress: order.deliveryAddressId,
    paymentMethod: order.paymentMethod,
    transactionId: order.transactionId ?? null,
    notes: order.notes ?? null,
    generatedAt: new Date(),
  };

  // TODO: Integrate PDF generation library (e.g., pdfkit, puppeteer) to generate actual PDF file
  // For now, return invoice data as JSON placeholder

  return sendSuccess(res, 'Invoice generated', { invoice }, HTTP_STATUS.OK) as any;
});

export { placeOrder, getOrder, getAdminOrder, getMyOrders, getAllOrders, cancelOrder, trackOrder, updateOrderStatus, updatePaymentStatus, downloadInvoice };
