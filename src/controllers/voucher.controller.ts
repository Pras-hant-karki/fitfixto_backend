import { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import { sendError, sendSuccess } from '../utils/apiResponse';
import { HTTP_STATUS } from '../constants/app.constants';
import { AppError } from '../utils/appError';
import Voucher from '../models/Voucher';
import Cart from '../models/Cart';
import Product from '../models/Product';
import { RequestWithUser } from '../middlewares/auth';

/**
 * Apply voucher to the current user's cart and return discount breakdown.
 * Supports percentage, fixed and bundle voucher types.
 */
const applyVoucher = asyncHandler(async (req: RequestWithUser, res: Response): Promise<void> => {
  if (!req.user) throw new AppError('Not authenticated', HTTP_STATUS.UNAUTHORIZED);

  const { code } = req.body as { code: string };

  const voucher = await Voucher.findOne({ code: code.toUpperCase(), active: true });
  if (!voucher) throw new AppError('Invalid voucher code', HTTP_STATUS.NOT_FOUND);

  if (voucher.expiresAt && new Date() > voucher.expiresAt) {
    throw new AppError('Voucher expired', HTTP_STATUS.BAD_REQUEST);
  }

  if (voucher.usageLimit && voucher.usedCount >= voucher.usageLimit) {
    throw new AppError('Voucher usage limit reached', HTTP_STATUS.BAD_REQUEST);
  }

  const cart = await Cart.findOne({ userId: req.user._id }).populate('items.productId');
  if (!cart || cart.items.length === 0) {
    throw new AppError('Cart is empty', HTTP_STATUS.BAD_REQUEST);
  }

  // compute cart subtotal and eligible subtotal
  let subtotal = 0;
  let eligibleSubtotal = 0; // for vouchers that apply to specific categories/products

  for (const item of cart.items) {
    // item.productId is populated
    const prod: any = item.productId;
    const lineTotal = (item.quantity || 0) * (prod.price ?? 0);
    subtotal += lineTotal;

    let eligible = true;
    if (voucher.appliesToCategories && voucher.appliesToCategories.length > 0) {
      eligible = !!prod.category && voucher.appliesToCategories.includes(prod.category as string);
    }

    if (voucher.appliesToProducts && voucher.appliesToProducts.length > 0) {
      eligible = eligible && voucher.appliesToProducts.some((pId) => pId.toString() === prod._id.toString());
    }

    if (eligible) eligibleSubtotal += lineTotal;
  }

  if (voucher.minOrderValue && subtotal < voucher.minOrderValue) {
    throw new AppError('Order does not meet minimum value for this voucher', HTTP_STATUS.BAD_REQUEST);
  }

  let discount = 0;

  if (voucher.type === 'percentage') {
    const pct = voucher.amount ?? 0;
    discount = Math.round((eligibleSubtotal * pct) / 100 * 100) / 100;
  } else if (voucher.type === 'fixed') {
    discount = Math.min(voucher.amount ?? 0, eligibleSubtotal);
  } else if (voucher.type === 'bundle') {
    // require bundle spec
    if (!voucher.bundle || !voucher.bundle.productIds || voucher.bundle.productIds.length === 0) {
      throw new AppError('Invalid bundle voucher configuration', HTTP_STATUS.INTERNAL_SERVER_ERROR);
    }

    // check if cart contains required products
    const bundleProdIds = voucher.bundle.productIds.map((id) => id.toString());
    const matchedItems = cart.items.filter((i) => bundleProdIds.includes(i.productId._id.toString()));

    if (matchedItems.length < bundleProdIds.length) {
      throw new AppError('Cart does not contain required products for this bundle voucher', HTTP_STATUS.BAD_REQUEST);
    }

    // sum matched subtotal
    const matchedSubtotal = matchedItems.reduce((s, it) => {
      const prod: any = it.productId;
      return s + (it.quantity || 0) * (prod.price ?? 0);
    }, 0);

    if (voucher.bundle.discountPercentage) {
      discount = Math.round((matchedSubtotal * voucher.bundle.discountPercentage) / 100 * 100) / 100;
    } else if (voucher.bundle.discountAmount) {
      discount = Math.min(voucher.bundle.discountAmount, matchedSubtotal);
    }
  }

  // ensure non-negative discount and not more than subtotal
  discount = Math.max(0, Math.min(discount, subtotal));

  const newTotal = Math.round((subtotal - discount) * 100) / 100;

  return sendSuccess(
    res,
    'Voucher applied',
    {
      code: voucher.code,
      subtotal,
      discount,
      newTotal,
    },
    HTTP_STATUS.OK
  ) as any;
});

export { applyVoucher };
