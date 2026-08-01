import { Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import { sendSuccess } from '../utils/apiResponse';
import { HTTP_STATUS } from '../constants/app.constants';
import { AppError } from '../utils/appError';
import { RequestWithUser } from '../middlewares/auth';
import Order from '../models/Order';
import { PaymentStatus } from '../types/index';
import { ConfirmCodPaymentRequest } from '../validations/payment.validation';

/**
 * Confirm Cash on Delivery Payment
 * POST /api/v1/payments/cod/confirm
 */
export const confirmCodPayment = asyncHandler(async (req: RequestWithUser, res: Response): Promise<void> => {
  if (!req.user) {
    throw new AppError('Not authenticated', HTTP_STATUS.UNAUTHORIZED);
  }

  const { orderId } = req.body as ConfirmCodPaymentRequest;

  const order = await Order.findOne({ _id: orderId, userId: req.user._id });
  if (!order) {
    throw new AppError('Order not found', HTTP_STATUS.NOT_FOUND);
  }

  if (order.paymentStatus !== PaymentStatus.PENDING) {
    throw new AppError('Order payment already processed', HTTP_STATUS.BAD_REQUEST);
  }

  if ((order as any).paymentMethod !== 'cash_on_delivery') {
    throw new AppError('This order does not use cash on delivery', HTTP_STATUS.BAD_REQUEST);
  }

  order.paymentStatus = PaymentStatus.COMPLETED;
  await order.save();

  sendSuccess(res, 'Cash on Delivery payment confirmed successfully', { order }, HTTP_STATUS.OK);
});

/**
 * eSewa payment initiation — not yet implemented with real gateway
 */
export const initiateEsewaPayment = asyncHandler(async (_req: RequestWithUser, _res: Response): Promise<void> => {
  throw new AppError('eSewa payment integration is coming soon. Please use card payment or cash on delivery.', HTTP_STATUS.NOT_IMPLEMENTED);
});

/**
 * eSewa payment verification — not yet implemented with real gateway
 */
export const verifyEsewaPayment = asyncHandler(async (_req: RequestWithUser, _res: Response): Promise<void> => {
  throw new AppError('eSewa payment integration is coming soon. Please use card payment or cash on delivery.', HTTP_STATUS.NOT_IMPLEMENTED);
});

/**
 * Khalti payment initiation — not yet implemented with real gateway
 */
export const initiateKhaltiPayment = asyncHandler(async (_req: RequestWithUser, _res: Response): Promise<void> => {
  throw new AppError('Khalti payment integration is coming soon. Please use card payment or cash on delivery.', HTTP_STATUS.NOT_IMPLEMENTED);
});

/**
 * Khalti payment verification — not yet implemented with real gateway
 */
export const verifyKhaltiPayment = asyncHandler(async (_req: RequestWithUser, _res: Response): Promise<void> => {
  throw new AppError('Khalti payment integration is coming soon. Please use card payment or cash on delivery.', HTTP_STATUS.NOT_IMPLEMENTED);
});
