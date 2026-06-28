import { Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import { sendSuccess } from '../utils/apiResponse';
import { HTTP_STATUS } from '../constants/app.constants';
import { AppError } from '../utils/appError';
import { RequestWithUser } from '../middlewares/auth';
import Trainer from '../models/Trainer';
import TrainerApplication from '../models/TrainerApplication';
import TrainerProgram from '../models/TrainerProgram';
import User from '../models/User';
import { UserRole } from '../types/index';
import { sendTrainerCredentialsEmail } from '../services/emailService';
import { CreateTrainerRequest, TrainerApplicationRequest, TrainerProgramRequest, UpdateTrainerProgramRequest, UpdateTrainerRequest } from '../validations/trainer.validation';

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

const listPublicTrainers = asyncHandler(async (_req: RequestWithUser, res: Response): Promise<void> => {
  const trainers = await Trainer.find({ isSuspended: false })
    .populate('userId', 'firstName lastName email phone bio profilePicture isActive')
    .sort({ isFeatured: -1, createdAt: -1 });

  const activeTrainers = trainers.filter((trainer) => {
    const user = trainer.userId as unknown as { isActive?: boolean } | null;
    return user?.isActive !== false;
  });

  return sendSuccess(res, 'Public trainers fetched successfully', { trainers: activeTrainers }, HTTP_STATUS.OK) as any;
});

const getPublicTrainer = asyncHandler(async (req: RequestWithUser, res: Response): Promise<void> => {
  const { trainerId } = req.params;
  const trainer = await Trainer.findOne({ _id: trainerId, isSuspended: false })
    .populate('userId', 'firstName lastName email phone bio profilePicture isActive');

  if (!trainer) {
    throw new AppError('Trainer not found', HTTP_STATUS.NOT_FOUND);
  }

  const user = trainer.userId as unknown as { isActive?: boolean } | null;
  if (user?.isActive === false) {
    throw new AppError('Trainer not found', HTTP_STATUS.NOT_FOUND);
  }

  return sendSuccess(res, 'Trainer fetched successfully', { trainer }, HTTP_STATUS.OK) as any;
});

const listPublicTrainerPrograms = asyncHandler(async (req: RequestWithUser, res: Response): Promise<void> => {
  const { trainerId } = req.params;

  const trainer = await Trainer.findOne({ _id: trainerId, isSuspended: false }).populate('userId', 'isActive');
  if (!trainer) {
    throw new AppError('Trainer not found', HTTP_STATUS.NOT_FOUND);
  }

  const user = trainer.userId as unknown as { isActive?: boolean } | null;
  if (user?.isActive === false) {
    throw new AppError('Trainer not found', HTTP_STATUS.NOT_FOUND);
  }

  const programs = await TrainerProgram.find({ trainerId, isActive: true }).sort({ createdAt: -1 });

  return sendSuccess(res, 'Trainer programs fetched successfully', { programs }, HTTP_STATUS.OK) as any;
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
    let credentialEmailSent = true;

    try {
      await sendTrainerCredentialsEmail(user.email, body.password);
    } catch (emailError) {
      credentialEmailSent = false;
      console.error('Trainer credential email failed:', emailError);
    }

    if (body.applicationId) {
      await TrainerApplication.findByIdAndUpdate(body.applicationId, {
        status: 'approved',
        reviewedAt: new Date(),
        reviewedBy: req.user?._id,
        createdTrainerId: trainer._id,
      });
    }

    return sendSuccess(res, 'Trainer created successfully', { trainer, credentialEmailSent }, HTTP_STATUS.CREATED) as any;
  } catch (error) {
    await User.findByIdAndDelete(user._id);
    throw error;
  }
});

const createTrainerApplication = asyncHandler(async (req: RequestWithUser, res: Response): Promise<void> => {
  const body = req.body as TrainerApplicationRequest;

  const application = await TrainerApplication.create({
    ...body,
    phone: body.phone || undefined,
    profilePicture: body.profilePicture || null,
    status: 'pending',
  });

  return sendSuccess(res, 'Trainer application submitted successfully', { application }, HTTP_STATUS.CREATED) as any;
});

const listTrainerApplications = asyncHandler(async (_req: RequestWithUser, res: Response): Promise<void> => {
  const applications = await TrainerApplication.find().sort({ createdAt: -1 });

  return sendSuccess(res, 'Trainer applications fetched successfully', { applications }, HTTP_STATUS.OK) as any;
});

const approveTrainerApplication = asyncHandler(async (req: RequestWithUser, res: Response): Promise<void> => {
  const { applicationId } = req.params;

  const application = await TrainerApplication.findByIdAndUpdate(
    applicationId,
    {
      status: 'approved',
      reviewedAt: new Date(),
      reviewedBy: req.user?._id,
    },
    { new: true, runValidators: true }
  );

  if (!application) {
    throw new AppError('Trainer application not found', HTTP_STATUS.NOT_FOUND);
  }

  return sendSuccess(res, 'Trainer application approved', { application }, HTTP_STATUS.OK) as any;
});

const rejectTrainerApplication = asyncHandler(async (req: RequestWithUser, res: Response): Promise<void> => {
  const { applicationId } = req.params;

  const application = await TrainerApplication.findByIdAndUpdate(
    applicationId,
    {
      status: 'rejected',
      reviewedAt: new Date(),
      reviewedBy: req.user?._id,
    },
    { new: true, runValidators: true }
  );

  if (!application) {
    throw new AppError('Trainer application not found', HTTP_STATUS.NOT_FOUND);
  }

  return sendSuccess(res, 'Trainer application rejected', { application }, HTTP_STATUS.OK) as any;
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

const getCurrentTrainer = async (req: RequestWithUser) => {
  const trainer = await Trainer.findOne({ userId: req.user?._id });

  if (!trainer) {
    throw new AppError('Trainer profile not found', HTTP_STATUS.NOT_FOUND);
  }

  return trainer;
};

const listMyTrainerPrograms = asyncHandler(async (req: RequestWithUser, res: Response): Promise<void> => {
  const trainer = await getCurrentTrainer(req);
  const programs = await TrainerProgram.find({ trainerId: trainer._id }).sort({ createdAt: -1 });

  return sendSuccess(res, 'Trainer programs fetched successfully', { programs }, HTTP_STATUS.OK) as any;
});

const createTrainerProgram = asyncHandler(async (req: RequestWithUser, res: Response): Promise<void> => {
  const trainer = await getCurrentTrainer(req);
  const body = req.body as TrainerProgramRequest;
  const program = await TrainerProgram.create({
    trainerId: trainer._id,
    ...body,
  });

  return sendSuccess(res, 'Trainer program created successfully', { program }, HTTP_STATUS.CREATED) as any;
});

const updateTrainerProgram = asyncHandler(async (req: RequestWithUser, res: Response): Promise<void> => {
  const trainer = await getCurrentTrainer(req);
  const body = req.body as UpdateTrainerProgramRequest;
  const { programId } = req.params;

  const program = await TrainerProgram.findOneAndUpdate({ _id: programId, trainerId: trainer._id }, body, {
    new: true,
    runValidators: true,
  });

  if (!program) {
    throw new AppError('Trainer program not found', HTTP_STATUS.NOT_FOUND);
  }

  return sendSuccess(res, 'Trainer program updated successfully', { program }, HTTP_STATUS.OK) as any;
});

const deleteTrainerProgram = asyncHandler(async (req: RequestWithUser, res: Response): Promise<void> => {
  const trainer = await getCurrentTrainer(req);
  const { programId } = req.params;
  const program = await TrainerProgram.findOneAndDelete({ _id: programId, trainerId: trainer._id });

  if (!program) {
    throw new AppError('Trainer program not found', HTTP_STATUS.NOT_FOUND);
  }

  return sendSuccess(res, 'Trainer program deleted successfully', { programId }, HTTP_STATUS.OK) as any;
});

export {
  listTrainers,
  listPublicTrainers,
  getPublicTrainer,
  listPublicTrainerPrograms,
  createTrainer,
  updateTrainer,
  deleteTrainer,
  uploadTrainerPhoto,
  createTrainerApplication,
  listTrainerApplications,
  approveTrainerApplication,
  rejectTrainerApplication,
  listMyTrainerPrograms,
  createTrainerProgram,
  updateTrainerProgram,
  deleteTrainerProgram,
};
