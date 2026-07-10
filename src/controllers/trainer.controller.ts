import { Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import { sendSuccess } from '../utils/apiResponse';
import { HTTP_STATUS } from '../constants/app.constants';
import { AppError } from '../utils/appError';
import { RequestWithUser } from '../middlewares/auth';
import Trainer from '../models/Trainer';
import TrainerAvailability from '../models/TrainerAvailability';
import TrainerAvailableDate from '../models/TrainerAvailableDate';
import TrainerApplication from '../models/TrainerApplication';
import TrainerProgram from '../models/TrainerProgram';
import User from '../models/User';
import Booking from '../models/Booking';
import { UserRole } from '../types/index';
import { sendTrainerCredentialsEmail } from '../services/emailService';
import {
  CreateTrainerRequest,
  TrainerApplicationRequest,
  TrainerAvailabilityRequest,
  TrainerCalendarAvailabilityRequest,
  TrainerProgramRequest,
  UpdateTrainerAvailabilityRequest,
  UpdateTrainerProgramRequest,
  UpdateTrainerRequest,
} from '../validations/trainer.validation';

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
    .sort({ isFeatured: -1, createdAt: -1 })
    .lean();

  const activeTrainers = trainers.filter((trainer) => {
    const user = trainer.userId as unknown as { isActive?: boolean } | null;
    return user?.isActive !== false;
  });

  // Aggregate ratings from completed bookings
  const trainerIds = activeTrainers.map((t) => t._id);
  const ratingAggs = await Booking.aggregate([
    { $match: { trainerId: { $in: trainerIds }, clientRating: { $exists: true, $ne: null } } },
    { $group: { _id: '$trainerId', averageRating: { $avg: '$clientRating' }, ratingCount: { $sum: 1 } } },
  ]);
  const ratingMap = new Map(ratingAggs.map((r) => [r._id.toString(), r]));

  const trainersWithRatings = activeTrainers.map((t) => ({
    ...t,
    averageRating: parseFloat((ratingMap.get(t._id.toString())?.averageRating ?? 0).toFixed(1)),
    ratingCount: ratingMap.get(t._id.toString())?.ratingCount ?? 0,
  }));

  return sendSuccess(res, 'Public trainers fetched successfully', { trainers: trainersWithRatings }, HTTP_STATUS.OK) as any;
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

const listPublicTrainerAvailability = asyncHandler(async (req: RequestWithUser, res: Response): Promise<void> => {
  const { trainerId } = req.params;

  const trainer = await Trainer.findOne({ _id: trainerId, isSuspended: false }).populate('userId', 'isActive');
  if (!trainer) {
    throw new AppError('Trainer not found', HTTP_STATUS.NOT_FOUND);
  }

  const user = trainer.userId as unknown as { isActive?: boolean } | null;
  if (user?.isActive === false) {
    throw new AppError('Trainer not found', HTTP_STATUS.NOT_FOUND);
  }

  const availability = await TrainerAvailability.find({ trainerId, isActive: true }).sort({ dayOfWeek: 1, timeLabel: 1 });
  const availableDates = await TrainerAvailableDate.find({ trainerId, date: { $gte: new Date() } }).sort({ date: 1 });

  return sendSuccess(res, 'Trainer availability fetched successfully', { availability, availableDates }, HTTP_STATUS.OK) as any;
});

const createTrainer = asyncHandler(async (req: RequestWithUser, res: Response): Promise<void> => {
  const body = req.body as CreateTrainerRequest;

  const normalizedEmail = body.email.trim().toLowerCase();
  const [emailOwner, phoneOwner] = await Promise.all([
    User.findOne({ email: normalizedEmail }).select('_id email role').lean(),
    User.findOne({ phone: body.phone.trim() }).select('_id email role').lean(),
  ]);

  if (emailOwner) {
    throw new AppError(
      `A ${emailOwner.role} account already uses ${normalizedEmail}. Use a different email for this trainer.`,
      HTTP_STATUS.CONFLICT
    );
  }

  if (phoneOwner) {
    throw new AppError(
      `This phone number already belongs to ${phoneOwner.email}. Enter a different phone number before creating the trainer.`,
      HTTP_STATUS.CONFLICT
    );
  }

  const user = await User.create({
    firstName: body.firstName,
    lastName: body.lastName,
    email: normalizedEmail,
    phone: body.phone.trim(),
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
    path: `trainers/${req.file.filename}`,
    mimetype: req.file.mimetype,
  };

  return sendSuccess(res, 'Trainer photo uploaded successfully', { photo }, HTTP_STATUS.OK) as any;
});

const uploadTrainerApplicationFiles = asyncHandler(async (req: RequestWithUser, res: Response): Promise<void> => {
  const files = (req.files || {}) as Record<string, Express.Multer.File[]>;
  const photo = files.photo?.[0];
  const certificates = files.certificates || [];

  if (!photo && certificates.length === 0) {
    throw new AppError('No application files uploaded', HTTP_STATUS.BAD_REQUEST);
  }

  return sendSuccess(
    res,
    'Trainer application files uploaded successfully',
    {
      photo: photo ? `trainers/${photo.filename}` : null,
      certificates: certificates.map((file) => `trainers/${file.filename}`),
    },
    HTTP_STATUS.OK
  ) as any;
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

const uploadTrainerProgramImage = asyncHandler(async (req: RequestWithUser, res: Response): Promise<void> => {
  await getCurrentTrainer(req);

  if (!req.file) {
    throw new AppError('No program image uploaded', HTTP_STATUS.BAD_REQUEST);
  }

  return sendSuccess(
    res,
    'Program image uploaded successfully',
    { image: `trainers/${req.file.filename}` },
    HTTP_STATUS.OK
  ) as any;
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

const listMyTrainerAvailability = asyncHandler(async (req: RequestWithUser, res: Response): Promise<void> => {
  const trainer = await getCurrentTrainer(req);
  const availability = await TrainerAvailability.find({ trainerId: trainer._id }).sort({ dayOfWeek: 1, timeLabel: 1 });

  return sendSuccess(res, 'Trainer availability fetched successfully', { availability }, HTTP_STATUS.OK) as any;
});

const listMyTrainerCalendarAvailability = asyncHandler(async (req: RequestWithUser, res: Response): Promise<void> => {
  const trainer = await getCurrentTrainer(req);
  const availableDates = await TrainerAvailableDate.find({ trainerId: trainer._id }).sort({ date: 1 });
  return sendSuccess(res, 'Trainer calendar availability fetched successfully', { availableDates }, HTTP_STATUS.OK) as any;
});

const saveMyTrainerCalendarAvailability = asyncHandler(async (req: RequestWithUser, res: Response): Promise<void> => {
  const trainer = await getCurrentTrainer(req);
  const body = req.body as TrainerCalendarAvailabilityRequest;
  const now = new Date();
  // Allow any date within the 3 calendar months shown on the UI (from the 1st of the
  // current month, not from today — weekly slot toggling can produce earlier dates in
  // the current month when today is not the 1st).
  const startOfMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 3, 1));
  const dates = Array.from(new Set(body.dates)).map((value) => new Date(`${value}T00:00:00.000Z`));

  if (dates.some((date) => Number.isNaN(date.getTime()) || date < startOfMonth || date >= end)) {
    throw new AppError('Availability dates must be within the current three-month calendar', HTTP_STATUS.BAD_REQUEST);
  }

  await TrainerAvailableDate.deleteMany({ trainerId: trainer._id });
  if (dates.length) {
    await TrainerAvailableDate.insertMany(dates.map((date) => ({ trainerId: trainer._id, date })));
  }

  const availableDates = await TrainerAvailableDate.find({ trainerId: trainer._id }).sort({ date: 1 });
  return sendSuccess(res, 'Trainer calendar availability saved successfully', { availableDates }, HTTP_STATUS.OK) as any;
});

const createTrainerAvailability = asyncHandler(async (req: RequestWithUser, res: Response): Promise<void> => {
  const trainer = await getCurrentTrainer(req);
  const body = req.body as TrainerAvailabilityRequest;
  const availability = await TrainerAvailability.create({
    trainerId: trainer._id,
    ...body,
  });

  return sendSuccess(res, 'Trainer availability created successfully', { availability }, HTTP_STATUS.CREATED) as any;
});

const updateTrainerAvailability = asyncHandler(async (req: RequestWithUser, res: Response): Promise<void> => {
  const trainer = await getCurrentTrainer(req);
  const body = req.body as UpdateTrainerAvailabilityRequest;
  const { slotId } = req.params;

  const availability = await TrainerAvailability.findOneAndUpdate({ _id: slotId, trainerId: trainer._id }, body, {
    new: true,
    runValidators: true,
  });

  if (!availability) {
    throw new AppError('Trainer availability slot not found', HTTP_STATUS.NOT_FOUND);
  }

  return sendSuccess(res, 'Trainer availability updated successfully', { availability }, HTTP_STATUS.OK) as any;
});

const deleteTrainerAvailability = asyncHandler(async (req: RequestWithUser, res: Response): Promise<void> => {
  const trainer = await getCurrentTrainer(req);
  const { slotId } = req.params;
  const availability = await TrainerAvailability.findOneAndDelete({ _id: slotId, trainerId: trainer._id });

  if (!availability) {
    throw new AppError('Trainer availability slot not found', HTTP_STATUS.NOT_FOUND);
  }

  return sendSuccess(res, 'Trainer availability deleted successfully', { slotId }, HTTP_STATUS.OK) as any;
});

const getPublicTrainerReviews = asyncHandler(async (req: RequestWithUser, res: Response): Promise<void> => {
  const { trainerId } = req.params;
  const reviews = await Booking.find({ trainerId, clientRating: { $exists: true, $ne: null } })
    .populate('clientId', 'firstName lastName profilePicture')
    .select('clientRating clientComment slotDate timeLabel clientId')
    .sort({ updatedAt: -1 })
    .lean();
  return sendSuccess(res, 'Trainer reviews', { reviews }, HTTP_STATUS.OK) as any;
});

export {
  listTrainers,
  listPublicTrainers,
  getPublicTrainer,
  listPublicTrainerPrograms,
  listPublicTrainerAvailability,
  createTrainer,
  updateTrainer,
  deleteTrainer,
  uploadTrainerPhoto,
  uploadTrainerApplicationFiles,
  createTrainerApplication,
  listTrainerApplications,
  approveTrainerApplication,
  rejectTrainerApplication,
  listMyTrainerPrograms,
  createTrainerProgram,
  uploadTrainerProgramImage,
  updateTrainerProgram,
  deleteTrainerProgram,
  listMyTrainerAvailability,
  listMyTrainerCalendarAvailability,
  saveMyTrainerCalendarAvailability,
  createTrainerAvailability,
  updateTrainerAvailability,
  deleteTrainerAvailability,
  getPublicTrainerReviews,
};
