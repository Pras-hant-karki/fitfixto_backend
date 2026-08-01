import { Request, Response } from 'express';
import { sendError } from '../utils/apiResponse';
import { asyncHandler } from '../utils/asyncHandler';

const notImplemented = (res: Response) => sendError(res, 'Not implemented', 501);

const createOrder = asyncHandler(async (_req: Request, res: Response): Promise<void> => {
  return notImplemented(res) as any;
});

const getOrder = asyncHandler(async (_req: Request, res: Response): Promise<void> => {
  return notImplemented(res) as any;
});

const updateOrderStatus = asyncHandler(async (_req: Request, res: Response): Promise<void> => {
  return notImplemented(res) as any;
});

const updatePaymentStatus = asyncHandler(async (_req: Request, res: Response): Promise<void> => {
  return notImplemented(res) as any;
});

export { createOrder, getOrder, updateOrderStatus, updatePaymentStatus };
