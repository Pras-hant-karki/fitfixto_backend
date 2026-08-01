import { Response } from 'express';
import { HTTP_STATUS } from '../constants/app.constants';
import { RequestWithUser } from '../middlewares/auth';
import PartnerGym from '../models/PartnerGym';
import { AppError } from '../utils/appError';
import { sendSuccess } from '../utils/apiResponse';
import { asyncHandler } from '../utils/asyncHandler';

const cleanPayload = (payload: Record<string, unknown>) =>
  Object.fromEntries(
    Object.entries(payload).map(([key, value]) => [key, value === '' ? undefined : value])
  );

export const listPartnerGyms = asyncHandler(async (_req, res: Response): Promise<void> => {
  const gyms = await PartnerGym.find().sort({ createdAt: -1 });

  return sendSuccess(res, 'Partner gyms fetched successfully', { gyms }, HTTP_STATUS.OK) as any;
});

export const listPublicPartnerGyms = asyncHandler(async (_req, res: Response): Promise<void> => {
  const gyms = await PartnerGym.find({ isVisible: true }).sort({ createdAt: -1 });

  return sendSuccess(res, 'Public partner gyms fetched successfully', { gyms }, HTTP_STATUS.OK) as any;
});

export const createPartnerGym = asyncHandler(async (req: RequestWithUser, res: Response): Promise<void> => {
  if (!req.user) {
    throw new AppError('Not authenticated', HTTP_STATUS.UNAUTHORIZED);
  }

  const gym = await PartnerGym.create(cleanPayload(req.body));

  return sendSuccess(res, 'Partner gym created successfully', { gym }, HTTP_STATUS.CREATED) as any;
});

export const updatePartnerGym = asyncHandler(async (req: RequestWithUser, res: Response): Promise<void> => {
  if (!req.user) {
    throw new AppError('Not authenticated', HTTP_STATUS.UNAUTHORIZED);
  }

  const gym = await PartnerGym.findByIdAndUpdate(req.params.gymId, cleanPayload(req.body), {
    new: true,
    runValidators: true,
  });

  if (!gym) {
    throw new AppError('Partner gym not found', HTTP_STATUS.NOT_FOUND);
  }

  return sendSuccess(res, 'Partner gym updated successfully', { gym }, HTTP_STATUS.OK) as any;
});

export const deletePartnerGym = asyncHandler(async (req: RequestWithUser, res: Response): Promise<void> => {
  if (!req.user) {
    throw new AppError('Not authenticated', HTTP_STATUS.UNAUTHORIZED);
  }

  const gym = await PartnerGym.findByIdAndDelete(req.params.gymId);

  if (!gym) {
    throw new AppError('Partner gym not found', HTTP_STATUS.NOT_FOUND);
  }

  return sendSuccess(res, 'Partner gym deleted successfully', { gymId: req.params.gymId }, HTTP_STATUS.OK) as any;
});

export const uploadPartnerGymImages = asyncHandler(async (req: RequestWithUser, res: Response): Promise<void> => {
  if (!req.files || !Array.isArray(req.files) || req.files.length === 0) {
    throw new AppError('No partner gym images uploaded', HTTP_STATUS.BAD_REQUEST);
  }

  const images = req.files.map((file) => ({
    filename: file.filename,
    path: `gyms/${file.filename}`,
    mimetype: file.mimetype,
  }));

  return sendSuccess(res, 'Partner gym images uploaded successfully', { images }, HTTP_STATUS.OK) as any;
});
