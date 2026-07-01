import { Response } from 'express';
import { HTTP_STATUS } from '../constants/app.constants';
import { RequestWithUser } from '../middlewares/auth';
import Service from '../models/Service';
import { AppError } from '../utils/appError';
import { sendSuccess } from '../utils/apiResponse';
import { asyncHandler } from '../utils/asyncHandler';

export const listServices = asyncHandler(async (_req, res: Response): Promise<void> => {
  const services = await Service.find().sort({ createdAt: -1 });
  return sendSuccess(res, 'Services fetched successfully', { services }, HTTP_STATUS.OK) as any;
});

export const listPublicServices = asyncHandler(async (_req, res: Response): Promise<void> => {
  const services = await Service.find({ isActive: true }).sort({ createdAt: -1 });
  return sendSuccess(res, 'Public services fetched successfully', { services }, HTTP_STATUS.OK) as any;
});

export const createService = asyncHandler(async (req: RequestWithUser, res: Response): Promise<void> => {
  if (!req.user) throw new AppError('Not authenticated', HTTP_STATUS.UNAUTHORIZED);

  const service = await Service.create(req.body);
  return sendSuccess(res, 'Service created successfully', { service }, HTTP_STATUS.CREATED) as any;
});

export const updateService = asyncHandler(async (req: RequestWithUser, res: Response): Promise<void> => {
  if (!req.user) throw new AppError('Not authenticated', HTTP_STATUS.UNAUTHORIZED);

  const service = await Service.findByIdAndUpdate(
    req.params.serviceId,
    req.body,
    { new: true, runValidators: true }
  );

  if (!service) throw new AppError('Service not found', HTTP_STATUS.NOT_FOUND);

  return sendSuccess(res, 'Service updated successfully', { service }, HTTP_STATUS.OK) as any;
});

export const deleteService = asyncHandler(async (req: RequestWithUser, res: Response): Promise<void> => {
  if (!req.user) throw new AppError('Not authenticated', HTTP_STATUS.UNAUTHORIZED);

  const service = await Service.findByIdAndDelete(req.params.serviceId);

  if (!service) throw new AppError('Service not found', HTTP_STATUS.NOT_FOUND);

  return sendSuccess(res, 'Service deleted successfully', { serviceId: req.params.serviceId }, HTTP_STATUS.OK) as any;
});

export const uploadServiceImage = asyncHandler(async (req: RequestWithUser, res: Response): Promise<void> => {
  if (!req.file) throw new AppError('No image uploaded', HTTP_STATUS.BAD_REQUEST);

  const image = {
    filename: req.file.filename,
    path: `/uploads/${req.file.filename}`,
    mimetype: req.file.mimetype,
  };

  return sendSuccess(res, 'Service image uploaded successfully', { image }, HTTP_STATUS.OK) as any;
});
