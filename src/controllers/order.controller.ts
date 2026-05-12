import { Request, Response } from 'express';
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
import { OrderStatus, PaymentStatus } from '../types/index';
import { PlaceOrderRequest } from '../validations/order.validation';

type CartProduct = {
  _id: string;
  price: number;
  stock: number;
  name: string;
  category: string;
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

  if ([OrderStatus.DELIVERED, OrderStatus.CANCELLED, OrderStatus.RETURNED].includes(order.status)) {
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

const updateOrderStatus = asyncHandler(async (_req: Request, res: Response): Promise<void> => {
  return sendSuccess(res, 'Not implemented', { message: 'Use admin order workflow later' }, HTTP_STATUS.OK) as any;
});

const updatePaymentStatus = asyncHandler(async (_req: Request, res: Response): Promise<void> => {
  return sendSuccess(res, 'Not implemented', { message: 'Use payment integration later' }, HTTP_STATUS.OK) as any;
});

export { placeOrder, getOrder, cancelOrder, updateOrderStatus, updatePaymentStatus };
