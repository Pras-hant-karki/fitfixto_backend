import { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import { sendSuccess } from '../utils/apiResponse';
import { HTTP_STATUS } from '../constants/app.constants';
import { AppError } from '../utils/appError';
import { RequestWithUser } from '../middlewares/auth';
import Order from '../models/Order';
import { PaymentStatus } from '../types/index';
import {
  ConfirmCodPaymentRequest,
  InitiateEsewaPaymentRequest,
  VerifyEsewaPaymentRequest,
  InitiateKhaltiPaymentRequest,
  VerifyKhaltiPaymentRequest,
} from '../validations/payment.validation';

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
 * Initiate eSewa Payment
 * POST /api/v1/payments/esewa/initiate
 * Returns mock transaction ID and redirect URL for testing
 */
export const initiateEsewaPayment = asyncHandler(async (req: RequestWithUser, res: Response): Promise<void> => {
  if (!req.user) {
    throw new AppError('Not authenticated', HTTP_STATUS.UNAUTHORIZED);
  }

  const { orderId, amount } = req.body as InitiateEsewaPaymentRequest;

  const order = await Order.findOne({ _id: orderId, userId: req.user._id });
  if (!order) {
    throw new AppError('Order not found', HTTP_STATUS.NOT_FOUND);
  }

  if (order.paymentStatus !== PaymentStatus.PENDING) {
    throw new AppError('Order payment already processed', HTTP_STATUS.BAD_REQUEST);
  }

  // Mock eSewa transaction ID generation
  const mockTransactionId = `ESEWA-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;

  // Mock eSewa redirect URL (in real implementation, this would be the actual eSewa gateway)
  const mockRedirectUrl = `https://mock-esewa.local/payment?transaction_id=${mockTransactionId}&amount=${amount}&success_url=http://localhost:3000/payment/esewa/success&failure_url=http://localhost:3000/payment/esewa/failure`;

  sendSuccess(
    res,
    'eSewa payment initiated successfully',
    {
      transactionId: mockTransactionId,
      redirectUrl: mockRedirectUrl,
      amount,
      orderId,
    },
    HTTP_STATUS.OK
  );
});

/**
 * Verify eSewa Payment
 * POST /api/v1/payments/esewa/verify
 * Mock verification endpoint for testing payment status
 */
export const verifyEsewaPayment = asyncHandler(async (req: RequestWithUser, res: Response): Promise<void> => {
  if (!req.user) {
    throw new AppError('Not authenticated', HTTP_STATUS.UNAUTHORIZED);
  }

  const { transactionId, orderId, status } = req.body as VerifyEsewaPaymentRequest;

  const order = await Order.findOne({ _id: orderId, userId: req.user._id });
  if (!order) {
    throw new AppError('Order not found', HTTP_STATUS.NOT_FOUND);
  }

  // Update payment status based on verification response
  if (status === 'success') {
    order.paymentStatus = PaymentStatus.COMPLETED;
    order.transactionId = transactionId;
    await order.save();
    sendSuccess(res, 'eSewa payment verified and confirmed', { order }, HTTP_STATUS.OK);
  } else if (status === 'failure') {
    order.paymentStatus = PaymentStatus.FAILED;
    await order.save();
    throw new AppError('eSewa payment failed', HTTP_STATUS.BAD_REQUEST);
  } else {
    order.paymentStatus = PaymentStatus.PENDING;
    await order.save();
    sendSuccess(res, 'eSewa payment pending', { order }, HTTP_STATUS.OK);
  }
});

/**
 * Initiate Khalti Payment
 * POST /api/v1/payments/khalti/initiate
 * Returns mock token and redirect URL for testing
 */
export const initiateKhaltiPayment = asyncHandler(async (req: RequestWithUser, res: Response): Promise<void> => {
  if (!req.user) {
    throw new AppError('Not authenticated', HTTP_STATUS.UNAUTHORIZED);
  }

  const { orderId, amount } = req.body as InitiateKhaltiPaymentRequest;

  const order = await Order.findOne({ _id: orderId, userId: req.user._id });
  if (!order) {
    throw new AppError('Order not found', HTTP_STATUS.NOT_FOUND);
  }

  if (order.paymentStatus !== PaymentStatus.PENDING) {
    throw new AppError('Order payment already processed', HTTP_STATUS.BAD_REQUEST);
  }

  // Mock Khalti token generation
  const mockToken = `KHALTI-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;

  // Mock Khalti redirect URL (in real implementation, this would be the actual Khalti gateway)
  const mockRedirectUrl = `https://mock-khalti.local/payment?token=${mockToken}&amount=${amount}&success_url=http://localhost:3000/payment/khalti/success&failure_url=http://localhost:3000/payment/khalti/failure`;

  sendSuccess(
    res,
    'Khalti payment initiated successfully',
    {
      token: mockToken,
      redirectUrl: mockRedirectUrl,
      amount,
      orderId,
    },
    HTTP_STATUS.OK
  );
});

/**
 * Verify Khalti Payment
 * POST /api/v1/payments/khalti/verify
 * Mock verification endpoint for testing payment status
 */
export const verifyKhaltiPayment = asyncHandler(async (req: RequestWithUser, res: Response): Promise<void> => {
  if (!req.user) {
    throw new AppError('Not authenticated', HTTP_STATUS.UNAUTHORIZED);
  }

  const { token, orderId, status } = req.body as VerifyKhaltiPaymentRequest;

  const order = await Order.findOne({ _id: orderId, userId: req.user._id });
  if (!order) {
    throw new AppError('Order not found', HTTP_STATUS.NOT_FOUND);
  }

  // Update payment status based on verification response
  if (status === 'success') {
    order.paymentStatus = PaymentStatus.COMPLETED;
    order.transactionId = token;
    await order.save();
    sendSuccess(res, 'Khalti payment verified and confirmed', { order }, HTTP_STATUS.OK);
  } else if (status === 'failure') {
    order.paymentStatus = PaymentStatus.FAILED;
    await order.save();
    throw new AppError('Khalti payment failed', HTTP_STATUS.BAD_REQUEST);
  } else {
    order.paymentStatus = PaymentStatus.PENDING;
    await order.save();
    sendSuccess(res, 'Khalti payment pending', { order }, HTTP_STATUS.OK);
  }
});
