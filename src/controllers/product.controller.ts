import { Request, Response } from 'express';
import { sendError, sendSuccess } from '../utils/apiResponse';
import { asyncHandler } from '../utils/asyncHandler';
import { HTTP_STATUS } from '../constants/app.constants';

const notImplemented = (res: Response) => sendError(res, 'Not implemented', 501);

const createProduct = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  return notImplemented(res) as any;
});

const listProducts = asyncHandler(async (_req: Request, res: Response): Promise<void> => {
  return notImplemented(res) as any;
});

const getProduct = asyncHandler(async (_req: Request, res: Response): Promise<void> => {
  return notImplemented(res) as any;
});

const updateProduct = asyncHandler(async (_req: Request, res: Response): Promise<void> => {
  return notImplemented(res) as any;
});

const deleteProduct = asyncHandler(async (_req: Request, res: Response): Promise<void> => {
  return notImplemented(res) as any;
});

export { createProduct, listProducts, getProduct, updateProduct, deleteProduct };
