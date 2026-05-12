import { Request, Response } from 'express';
import { sendError, sendSuccess } from '../utils/apiResponse';
import { asyncHandler } from '../utils/asyncHandler';
import { HTTP_STATUS } from '../constants/app.constants';
import Product from '../models/Product';
import { RequestWithUser } from '../middlewares/auth';

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

const uploadProductImages = asyncHandler(async (req: RequestWithUser, res: Response): Promise<void> => {
  if (!req.files || !Array.isArray(req.files) || req.files.length === 0) {
    return sendError(res, 'No product images uploaded', HTTP_STATUS.BAD_REQUEST) as any;
  }

  const images = req.files.map((file) => ({
    filename: file.filename,
    path: `/uploads/${file.filename}`,
    mimetype: file.mimetype,
  }));

  return sendSuccess(
    res,
    'Product images uploaded successfully',
    { images },
    HTTP_STATUS.OK
  ) as any;
});

export { createProduct, listProducts, getProduct, updateProduct, deleteProduct, uploadProductImages };
