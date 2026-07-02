import { Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import { sendSuccess } from '../utils/apiResponse';
import { HTTP_STATUS } from '../constants/app.constants';
import { AppError } from '../utils/appError';
import { RequestWithUser } from '../middlewares/auth';
import ServiceBooking from '../models/ServiceBooking';
import Service from '../models/Service';
import { CreateServiceBookingRequest, UpdateServiceBookingStatusRequest } from '../validations/serviceBooking.validation';

const SERVICE_POPULATE = 'name charge priceLabel image';
const CLIENT_POPULATE = 'firstName lastName email';

export const createServiceBooking = asyncHandler(async (req: RequestWithUser, res: Response): Promise<void> => {
  const body = req.body as CreateServiceBookingRequest;

  const service = await Service.findOne({ _id: body.serviceId, isActive: true });
  if (!service) throw new AppError('Service not found or unavailable', HTTP_STATUS.NOT_FOUND);

  const scheduledDate = new Date(body.scheduledDate);
  if (isNaN(scheduledDate.getTime()) || scheduledDate < new Date()) {
    throw new AppError('Please select a valid future date', HTTP_STATUS.BAD_REQUEST);
  }

  const booking = await ServiceBooking.create({
    clientId: req.user?._id,
    serviceId: service._id,
    scheduledDate,
    contactName: body.contactName,
    contactEmail: body.contactEmail,
    contactPhone: body.contactPhone,
    notes: body.notes || undefined,
    amount: service.charge,
    status: 'pending',
  });

  await booking.populate('serviceId', SERVICE_POPULATE);
  return sendSuccess(res, 'Service booking created', { booking }, HTTP_STATUS.CREATED) as any;
});

export const getMyServiceBookings = asyncHandler(async (req: RequestWithUser, res: Response): Promise<void> => {
  const bookings = await ServiceBooking.find({ clientId: req.user?._id })
    .populate('serviceId', SERVICE_POPULATE)
    .sort({ createdAt: -1 });
  return sendSuccess(res, 'Service bookings fetched', { bookings }) as any;
});

export const getAllServiceBookings = asyncHandler(async (req: RequestWithUser, res: Response): Promise<void> => {
  const bookings = await ServiceBooking.find()
    .populate('serviceId', SERVICE_POPULATE)
    .populate('clientId', CLIENT_POPULATE)
    .sort({ createdAt: -1 });
  return sendSuccess(res, 'All service bookings fetched', { bookings }) as any;
});

export const updateServiceBookingStatus = asyncHandler(async (req: RequestWithUser, res: Response): Promise<void> => {
  const body = req.body as UpdateServiceBookingStatusRequest;
  const booking = await ServiceBooking.findByIdAndUpdate(
    req.params.bookingId,
    { status: body.status, ...(body.adminNotes !== undefined ? { adminNotes: body.adminNotes } : {}) },
    { new: true, runValidators: true }
  )
    .populate('serviceId', SERVICE_POPULATE)
    .populate('clientId', CLIENT_POPULATE);

  if (!booking) throw new AppError('Service booking not found', HTTP_STATUS.NOT_FOUND);
  return sendSuccess(res, 'Status updated', { booking }) as any;
});

export const cancelMyServiceBooking = asyncHandler(async (req: RequestWithUser, res: Response): Promise<void> => {
  const booking = await ServiceBooking.findOne({ _id: req.params.bookingId, clientId: req.user?._id });
  if (!booking) throw new AppError('Booking not found', HTTP_STATUS.NOT_FOUND);
  if (booking.status === 'completed') throw new AppError('Cannot cancel a completed booking', HTTP_STATUS.BAD_REQUEST);
  booking.status = 'cancelled';
  await booking.save();
  return sendSuccess(res, 'Booking cancelled', { booking }) as any;
});

export const submitServiceClientReview = asyncHandler(async (req: RequestWithUser, res: Response): Promise<void> => {
  const { bookingId } = req.params;
  const { rating, comment } = req.body as { rating: number; comment?: string };

  if (!rating || rating < 1 || rating > 5) {
    throw new AppError('Rating must be between 1 and 5', HTTP_STATUS.BAD_REQUEST);
  }

  const booking = await ServiceBooking.findOne({ _id: bookingId, clientId: req.user?._id, status: 'completed' });
  if (!booking) throw new AppError('Completed service booking not found', HTTP_STATUS.NOT_FOUND);
  if (booking.clientRating) throw new AppError('You have already reviewed this service', HTTP_STATUS.CONFLICT);

  booking.clientRating = rating;
  booking.clientComment = comment?.trim();
  await booking.save();

  await booking.populate('serviceId', SERVICE_POPULATE);
  return sendSuccess(res, 'Review submitted successfully', { booking }, HTTP_STATUS.OK) as any;
});
