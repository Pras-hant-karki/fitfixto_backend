import { Response } from 'express';
import Product from '../models/Product';
import Wishlist from '../models/Wishlist';
import { RequestWithUser } from '../middlewares/auth';
import { asyncHandler } from '../utils/asyncHandler';
import { sendSuccess } from '../utils/apiResponse';
import { HTTP_STATUS } from '../constants/app.constants';
import { AppError } from '../utils/appError';

const populateWishlist = (userId: unknown) =>
  Wishlist.findOne({ userId }).populate('items.productId');

const getWishlist = asyncHandler(async (req: RequestWithUser, res: Response): Promise<void> => {
  if (!req.user) throw new AppError('Not authenticated', HTTP_STATUS.UNAUTHORIZED);

  const wishlist = await populateWishlist(req.user._id);

  return sendSuccess(res, 'Wishlist fetched', { wishlist: wishlist ?? { items: [] } }, HTTP_STATUS.OK) as any;
});

const addToWishlist = asyncHandler(async (req: RequestWithUser, res: Response): Promise<void> => {
  if (!req.user) throw new AppError('Not authenticated', HTTP_STATUS.UNAUTHORIZED);

  const { productId } = req.body as { productId: string };

  const product = await Product.findOne({ _id: productId, isActive: true });
  if (!product) throw new AppError('Product not found', HTTP_STATUS.NOT_FOUND);

  let wishlist = await Wishlist.findOne({ userId: req.user._id });
  if (!wishlist) {
    wishlist = await Wishlist.create({ userId: req.user._id, items: [] });
  }

  const exists = wishlist.items.some((item) => item.productId.toString() === productId);
  if (!exists) {
    wishlist.items.push({ productId: product._id, addedAt: new Date() });
    await wishlist.save();
  }

  const populatedWishlist = await populateWishlist(req.user._id);

  return sendSuccess(res, 'Added to wishlist', { wishlist: populatedWishlist }, HTTP_STATUS.OK) as any;
});

const removeFromWishlist = asyncHandler(async (req: RequestWithUser, res: Response): Promise<void> => {
  if (!req.user) throw new AppError('Not authenticated', HTTP_STATUS.UNAUTHORIZED);

  const { productId } = req.body as { productId: string };

  const wishlist = await Wishlist.findOne({ userId: req.user._id });
  if (!wishlist) throw new AppError('Wishlist not found', HTTP_STATUS.NOT_FOUND);

  const before = wishlist.items.length;
  wishlist.items = wishlist.items.filter((item) => item.productId.toString() !== productId);

  if (wishlist.items.length === before) {
    throw new AppError('Item not found in wishlist', HTTP_STATUS.NOT_FOUND);
  }

  await wishlist.save();

  const populatedWishlist = await populateWishlist(req.user._id);

  return sendSuccess(res, 'Item removed from wishlist', { wishlist: populatedWishlist }, HTTP_STATUS.OK) as any;
});

export { getWishlist, addToWishlist, removeFromWishlist };
