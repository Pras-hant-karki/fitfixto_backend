import { Request, Response } from 'express';
import Cart from '../models/Cart';
import Product from '../models/Product';
import { RequestWithUser } from '../middlewares/auth';
import { asyncHandler } from '../utils/asyncHandler';
import { sendError, sendSuccess } from '../utils/apiResponse';
import { HTTP_STATUS } from '../constants/app.constants';
import { AppError } from '../utils/appError';

const getCart = asyncHandler(async (req: RequestWithUser, res: Response): Promise<void> => {
  if (!req.user) throw new AppError('Not authenticated', HTTP_STATUS.UNAUTHORIZED);

  const cart = await Cart.findOne({ userId: req.user._id }).populate('items.productId');

  return sendSuccess(res, 'Cart fetched', { cart: cart ?? { items: [] } }, HTTP_STATUS.OK) as any;
});

const addToCart = asyncHandler(async (req: RequestWithUser, res: Response): Promise<void> => {
  if (!req.user) throw new AppError('Not authenticated', HTTP_STATUS.UNAUTHORIZED);

  const { productId, quantity } = req.body as { productId: string; quantity: number };

  const product = await Product.findById(productId);
  if (!product) throw new AppError('Product not found', HTTP_STATUS.NOT_FOUND);

  if (product.stock !== undefined && product.stock < quantity) {
    throw new AppError('Insufficient stock', HTTP_STATUS.BAD_REQUEST);
  }

  let cart = await Cart.findOne({ userId: req.user._id });
  if (!cart) {
    cart = await Cart.create({ userId: req.user._id, items: [] });
  }

  const existing = cart.items.find((i) => i.productId.toString() === productId);
  if (existing) {
    const newQty = existing.quantity + quantity;
    if (product.stock !== undefined && product.stock < newQty) {
      throw new AppError('Insufficient stock for requested quantity', HTTP_STATUS.BAD_REQUEST);
    }
    existing.quantity = newQty;
    existing.priceAtAdded = product.price;
  } else {
    cart.items.push({ productId: product._id, quantity, priceAtAdded: product.price });
  }

  await cart.save();

  return sendSuccess(res, 'Added to cart', { cart }, HTTP_STATUS.OK) as any;
});

const updateCartItem = asyncHandler(async (req: RequestWithUser, res: Response): Promise<void> => {
  if (!req.user) throw new AppError('Not authenticated', HTTP_STATUS.UNAUTHORIZED);

  const { productId, quantity } = req.body as { productId: string; quantity: number };

  const cart = await Cart.findOne({ userId: req.user._id });
  if (!cart) throw new AppError('Cart not found', HTTP_STATUS.NOT_FOUND);

  const itemIndex = cart.items.findIndex((i) => i.productId.toString() === productId);
  if (itemIndex === -1) throw new AppError('Item not found in cart', HTTP_STATUS.NOT_FOUND);

  const product = await Product.findById(productId);
  if (!product) throw new AppError('Product not found', HTTP_STATUS.NOT_FOUND);

  if (quantity <= 0) {
    // remove item
    cart.items.splice(itemIndex, 1);
  } else {
    if (product.stock !== undefined && product.stock < quantity) {
      throw new AppError('Insufficient stock', HTTP_STATUS.BAD_REQUEST);
    }
    cart.items[itemIndex].quantity = quantity;
    cart.items[itemIndex].priceAtAdded = product.price;
  }

  await cart.save();

  return sendSuccess(res, 'Cart updated', { cart }, HTTP_STATUS.OK) as any;
});

const removeFromCart = asyncHandler(async (req: RequestWithUser, res: Response): Promise<void> => {
  if (!req.user) throw new AppError('Not authenticated', HTTP_STATUS.UNAUTHORIZED);

  const { productId } = req.body as { productId: string };

  const cart = await Cart.findOne({ userId: req.user._id });
  if (!cart) throw new AppError('Cart not found', HTTP_STATUS.NOT_FOUND);

  const before = cart.items.length;
  cart.items = cart.items.filter((i) => i.productId.toString() !== productId);
  if (cart.items.length === before) throw new AppError('Item not found in cart', HTTP_STATUS.NOT_FOUND);

  await cart.save();

  return sendSuccess(res, 'Item removed from cart', { cart }, HTTP_STATUS.OK) as any;
});

const clearCart = asyncHandler(async (req: RequestWithUser, res: Response): Promise<void> => {
  if (!req.user) throw new AppError('Not authenticated', HTTP_STATUS.UNAUTHORIZED);

  const cart = await Cart.findOne({ userId: req.user._id });
  if (!cart) return sendSuccess(res, 'Cart cleared', { cart: { items: [] } }, HTTP_STATUS.OK) as any;

  cart.items = [];
  await cart.save();

  return sendSuccess(res, 'Cart cleared', { cart }, HTTP_STATUS.OK) as any;
});

export { getCart, addToCart, updateCartItem, removeFromCart, clearCart };
