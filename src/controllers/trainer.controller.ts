import { Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import { sendSuccess } from '../utils/apiResponse';
import { HTTP_STATUS } from '../constants/app.constants';
import { AppError } from '../utils/appError';
import { RequestWithUser } from '../middlewares/auth';
import Trainer from '../models/Trainer';
import User from '../models/User';
import { UserRole } from '../types/index';
import { CreateTrainerRequest, UpdateTrainerRequest } from '../validations/trainer.validation';

const buildTrainerPayload = (body: CreateTrainerRequest | UpdateTrainerRequest) => ({
  location: body.location,
  sessionRate: body.sessionRate,
  experienceYears: body.experienceYears,
  specialties: body.specialties,
  certifications: body.certifications,
  isFeatured: body.isFeatured,
  isSuspended: body.isSuspended,
});

const listTrainers = asyncHandler(async (_req: RequestWithUser, res: Response): Promise<void> => {
  const trainers = await Trainer.find()
    .populate('userId', 'firstName lastName email phone bio profilePicture isActive')
    .sort({ createdAt: -1 });

  return sendSuccess(res, 'Trainers fetched successfully', { trainers }, HTTP_STATUS.OK) as any;
});

const createTrainer = asyncHandler(async (req: RequestWithUser, res: Response): Promise<void> => {
  const body = req.body as CreateTrainerRequest;

  const user = await User.create({
    firstName: body.firstName,
    lastName: body.lastName,
    email: body.email,
    phone: body.phone,
    password: body.password,
    role: UserRole.TRAINER,
    bio: body.bio,
    profilePicture: body.profilePicture || null,
    isEmailVerified: true,
    isActive: !body.isSuspended,
  });

  try {
    const trainer = await Trainer.create({
      userId: user._id,
      ...buildTrainerPayload(body),
    });

    await trainer.populate('userId', 'firstName lastName email phone bio profilePicture isActive');
    return sendSuccess(res, 'Trainer created successfully', { trainer }, HTTP_STATUS.CREATED) as any;
  } catch (error) {
    await User.findByIdAndDelete(user._id);
    throw error;
  }
});

const updateTrainer = asyncHandler(async (req: RequestWithUser, res: Response): Promise<void> => {
  const { trainerId } = req.params;
  const body = req.body as UpdateTrainerRequest;

  const trainer = await Trainer.findById(trainerId);
  if (!trainer) {
    throw new AppError('Trainer not found', HTTP_STATUS.NOT_FOUND);
  }

  const userUpdates: Record<string, unknown> = {};
  ['firstName', 'lastName', 'email', 'phone', 'bio', 'profilePicture', 'password'].forEach((key) => {
    if (key in body) {
      userUpdates[key] = body[key as keyof UpdateTrainerRequest];
    }
  });

  if ('isSuspended' in body) {
    userUpdates.isActive = !body.isSuspended;
  }

  if (Object.keys(userUpdates).length > 0) {
    const user = await User.findById(trainer.userId).select('+password');
    if (!user) {
      throw new AppError('Trainer user account not found', HTTP_STATUS.NOT_FOUND);
    }

    Object.assign(user, userUpdates);
    await user.save();
  }

  Object.entries(buildTrainerPayload(body)).forEach(([key, value]) => {
    if (value !== undefined) {
      trainer.set(key, value);
    }
  });

  await trainer.save();
  await trainer.populate('userId', 'firstName lastName email phone bio profilePicture isActive');

  return sendSuccess(res, 'Trainer updated successfully', { trainer }, HTTP_STATUS.OK) as any;
});

const deleteTrainer = asyncHandler(async (req: RequestWithUser, res: Response): Promise<void> => {
  const { trainerId } = req.params;

  const trainer = await Trainer.findByIdAndDelete(trainerId);
  if (!trainer) {
    throw new AppError('Trainer not found', HTTP_STATUS.NOT_FOUND);
  }

  await User.findByIdAndDelete(trainer.userId);

  return sendSuccess(res, 'Trainer deleted successfully', { trainerId }, HTTP_STATUS.OK) as any;
});

const uploadTrainerPhoto = asyncHandler(async (req: RequestWithUser, res: Response): Promise<void> => {
  if (!req.file) {
    throw new AppError('No trainer photo uploaded', HTTP_STATUS.BAD_REQUEST);
  }

  const photo = {
    filename: req.file.filename,
    path: `/uploads/${req.file.filename}`,
    mimetype: req.file.mimetype,
  };

  return sendSuccess(res, 'Trainer photo uploaded successfully', { photo }, HTTP_STATUS.OK) as any;
});

export { listTrainers, createTrainer, updateTrainer, deleteTrainer, uploadTrainerPhoto };
