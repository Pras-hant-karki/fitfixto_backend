import { Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import { sendSuccess } from '../utils/apiResponse';
import { HTTP_STATUS } from '../constants/app.constants';
import { AppError } from '../utils/appError';
import { RequestWithUser } from '../middlewares/auth';
import Booking from '../models/Booking';
import Trainer from '../models/Trainer';
import TrainerAvailability from '../models/TrainerAvailability';
import { CreateBookingRequest, UpdateBookingStatusRequest } from '../validations/booking.validation';

const getTrainerByUserId = async (userId: unknown) => {
  const trainer = await Trainer.findOne({ userId });
  if (!trainer) throw new AppError('Trainer profile not found', HTTP_STATUS.NOT_FOUND);
  return trainer;
};

const createBooking = asyncHandler(async (req: RequestWithUser, res: Response): Promise<void> => {
  const body = req.body as CreateBookingRequest;

  const trainer = await Trainer.findOne({ _id: body.trainerId, isSuspended: false }).populate('userId', 'isActive');
  if (!trainer || (trainer.userId as unknown as { isActive?: boolean })?.isActive === false) {
    throw new AppError('Trainer not found or unavailable', HTTP_STATUS.NOT_FOUND);
  }

  const slotDate = new Date(`${body.slotDate}T00:00:00.000Z`);
  if (Number.isNaN(slotDate.getTime()) || slotDate < new Date(new Date().toISOString().slice(0, 10))) {
    throw new AppError('Please select a valid future booking date', HTTP_STATUS.BAD_REQUEST);
  }

  const dayKeys = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
  const availability = await TrainerAvailability.findOne({
    trainerId: trainer._id,
    dayOfWeek: dayKeys[slotDate.getUTCDay()],
    timeLabel: body.timeLabel,
    isActive: true,
  });
  if (!availability) throw new AppError('This trainer is not available at the selected date and time', HTTP_STATUS.CONFLICT);

  const existingBooking = await Booking.findOne({
    trainerId: trainer._id,
    slotDate,
    timeLabel: body.timeLabel,
    status: { $in: ['pending', 'confirmed'] },
  });
  if (existingBooking) throw new AppError('This time slot has already been booked', HTTP_STATUS.CONFLICT);

  const sessionConfig = {
    single: { count: 1, multiplier: 1 },
    five_pack: { count: 5, multiplier: 4.5 },
    ten_pack: { count: 10, multiplier: 8.5 },
  }[body.sessionType];
  const subtotal = Number((trainer.sessionRate * sessionConfig.multiplier).toFixed(2));
  const serviceFee = Number((subtotal * 0.02).toFixed(2));

  const booking = await Booking.create({
    clientId: req.user?._id,
    trainerId: trainer._id,
    slotDate,
    timeLabel: body.timeLabel,
    sessionType: body.sessionType,
    sessionCount: sessionConfig.count,
    contactName: body.contactName,
    contactEmail: body.contactEmail,
    contactPhone: body.contactPhone,
    paymentMethod: body.paymentMethod,
    subtotal,
    serviceFee,
    totalAmount: Number((subtotal + serviceFee).toFixed(2)),
    notes: body.notes,
    status: 'pending',
  });

  await booking.populate([
    { path: 'trainerId', select: 'location sessionRate', populate: { path: 'userId', select: 'firstName lastName profilePicture' } },
  ]);

  return sendSuccess(res, 'Booking created successfully', { booking }, HTTP_STATUS.CREATED) as any;
});

const getMyClientBookings = asyncHandler(async (req: RequestWithUser, res: Response): Promise<void> => {
  const bookings = await Booking.find({ clientId: req.user?._id })
    .populate({
      path: 'trainerId',
      select: 'userId location sessionRate',
      populate: { path: 'userId', select: 'firstName lastName email profilePicture' },
    })
    .sort({ slotDate: -1, createdAt: -1 });

  return sendSuccess(res, 'Bookings fetched successfully', { bookings }, HTTP_STATUS.OK) as any;
});

const getMyTrainerBookings = asyncHandler(async (req: RequestWithUser, res: Response): Promise<void> => {
  const trainer = await getTrainerByUserId(req.user?._id);

  const bookings = await Booking.find({ trainerId: trainer._id })
    .populate('clientId', 'firstName lastName email phone profilePicture')
    .sort({ slotDate: -1, createdAt: -1 });

  return sendSuccess(res, 'Trainer bookings fetched successfully', { bookings }, HTTP_STATUS.OK) as any;
});

const updateBookingStatus = asyncHandler(async (req: RequestWithUser, res: Response): Promise<void> => {
  const trainer = await getTrainerByUserId(req.user?._id);
  const { bookingId } = req.params;
  const body = req.body as UpdateBookingStatusRequest;

  const booking = await Booking.findOneAndUpdate(
    { _id: bookingId, trainerId: trainer._id },
    { status: body.status, ...(body.trainerNotes !== undefined && { trainerNotes: body.trainerNotes }) },
    { new: true, runValidators: true }
  ).populate('clientId', 'firstName lastName email phone profilePicture');

  if (!booking) throw new AppError('Booking not found', HTTP_STATUS.NOT_FOUND);

  return sendSuccess(res, 'Booking updated successfully', { booking }, HTTP_STATUS.OK) as any;
});

const cancelMyBooking = asyncHandler(async (req: RequestWithUser, res: Response): Promise<void> => {
  const { bookingId } = req.params;

  const booking = await Booking.findOneAndUpdate(
    { _id: bookingId, clientId: req.user?._id, status: { $in: ['pending', 'confirmed'] } },
    { status: 'cancelled' },
    { new: true }
  );

  if (!booking) throw new AppError('Booking not found or cannot be cancelled', HTTP_STATUS.NOT_FOUND);

  return sendSuccess(res, 'Booking cancelled successfully', { booking }, HTTP_STATUS.OK) as any;
});

const getMyClients = asyncHandler(async (req: RequestWithUser, res: Response): Promise<void> => {
  const trainer = await getTrainerByUserId(req.user?._id);

  const bookings = await Booking.find({ trainerId: trainer._id, status: { $ne: 'cancelled' } })
    .populate('clientId', 'firstName lastName email phone profilePicture createdAt isActive')
    .sort({ slotDate: -1, createdAt: -1 })
    .lean();

  const clientMap = new Map<
    string,
    {
      user: Record<string, unknown>;
      bookingCount: number;
      lastBooking: Date;
      lastProgram: string;
      upcomingSessions: number;
    }
  >();
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const sessionLabels = {
    single: 'Single Session',
    five_pack: '5-Session Pack',
    ten_pack: '10-Session Pack',
  } as const;

  for (const booking of bookings) {
    const client = booking.clientId as unknown as Record<string, unknown>;
    if (!client || !client._id) continue;
    const clientId = String(client._id);
    const existing = clientMap.get(clientId);
    const sessionCount = booking.sessionCount || 1;
    const upcomingSessions =
      booking.slotDate >= today && ['pending', 'confirmed'].includes(booking.status) ? sessionCount : 0;
    const lastProgram = sessionLabels[booking.sessionType || 'single'];

    if (existing) {
      existing.bookingCount += sessionCount;
      existing.upcomingSessions += upcomingSessions;
      if (booking.slotDate > existing.lastBooking) {
        existing.lastBooking = booking.slotDate;
        existing.lastProgram = lastProgram;
      }
    } else {
      clientMap.set(clientId, {
        user: client,
        bookingCount: sessionCount,
        lastBooking: booking.slotDate,
        lastProgram,
        upcomingSessions,
      });
    }
  }

  const clients = Array.from(clientMap.values()).sort(
    (a, b) => b.lastBooking.getTime() - a.lastBooking.getTime()
  );

  return sendSuccess(res, 'Trainer clients fetched successfully', { clients }, HTTP_STATUS.OK) as any;
});

export {
  createBooking,
  getMyClientBookings,
  getMyTrainerBookings,
  updateBookingStatus,
  cancelMyBooking,
  getMyClients,
};
