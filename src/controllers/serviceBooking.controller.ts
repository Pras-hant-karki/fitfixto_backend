import { Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import { sendSuccess } from '../utils/apiResponse';
import { HTTP_STATUS } from '../constants/app.constants';
import { AppError } from '../utils/appError';
import { RequestWithUser } from '../middlewares/auth';
import ServiceBooking, { ServiceBookingStatus } from '../models/ServiceBooking';
import Service from '../models/Service';
import { CreateServiceBookingRequest, UpdateServiceBookingStatusRequest } from '../validations/serviceBooking.validation';

const SERVICE_POPULATE = 'name charge priceLabel image';
const CLIENT_POPULATE = 'firstName lastName email';

export const createServiceBooking = asyncHandler(async (req: RequestWithUser, res: Response): Promise<void> => {
  const body = req.body as CreateServiceBookingRequest;

  const service = await Service.findOne({ _id: body.serviceId, isActive: true });
  if (!service) throw new AppError('Service not found or unavailable', HTTP_STATUS.NOT_FOUND);

  const scheduledDate = new Date(body.scheduledDate);
  const todayUtc = new Date(new Date().toISOString().slice(0, 10) + 'T00:00:00.000Z');
  if (isNaN(scheduledDate.getTime()) || scheduledDate <= todayUtc) {
    throw new AppError('Scheduled date must be at least one day in the future', HTTP_STATUS.BAD_REQUEST);
  }

  const existingServiceBooking = await ServiceBooking.findOne({
    clientId: req.user?._id,
    serviceId: service._id,
    status: { $in: ['pending', 'confirmed'] },
  });
  if (existingServiceBooking) {
    throw new AppError(
      'You already have a pending or confirmed booking for this service. Please wait for it to be resolved before submitting another request.',
      HTTP_STATUS.CONFLICT
    );
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
  const { page, limit, search, status } = req.query as { page?: string; limit?: string; search?: string; status?: string };
  const pageNum = Math.max(1, parseInt(page || '1', 10) || 1);
  const limitNum = Math.min(100, Math.max(1, parseInt(limit || '20', 10) || 20));
  const skip = (pageNum - 1) * limitNum;

  const filter: Record<string, unknown> = {};
  if (status && status !== 'all') {
    filter.status = status;
  }
  if (search?.trim()) {
    const safeSearch = search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(safeSearch, 'i');
    filter.$or = [{ contactName: regex }, { contactEmail: regex }];
  }

  const [bookings, total] = await Promise.all([
    ServiceBooking.find(filter)
      .populate('serviceId', SERVICE_POPULATE)
      .populate('clientId', CLIENT_POPULATE)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum),
    ServiceBooking.countDocuments(filter),
  ]);

  return sendSuccess(
    res,
    'All service bookings fetched',
    {
      bookings,
      pagination: {
        total,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(total / limitNum),
        hasNextPage: pageNum * limitNum < total,
        hasPrevPage: pageNum > 1,
      },
    },
    HTTP_STATUS.OK
  ) as any;
});

const SERVICE_BOOKING_TRANSITIONS: Record<ServiceBookingStatus, ServiceBookingStatus[]> = {
  pending:   ['confirmed', 'cancelled'],
  confirmed: ['completed', 'cancelled'],
  completed: [],
  cancelled: [],
};

export const updateServiceBookingStatus = asyncHandler(async (req: RequestWithUser, res: Response): Promise<void> => {
  const body = req.body as UpdateServiceBookingStatusRequest;

  const booking = await ServiceBooking.findById(req.params.bookingId);
  if (!booking) throw new AppError('Service booking not found', HTTP_STATUS.NOT_FOUND);

  const allowed = SERVICE_BOOKING_TRANSITIONS[booking.status];
  if (!allowed.includes(body.status as ServiceBookingStatus)) {
    throw new AppError(
      `Cannot change booking status from '${booking.status}' to '${body.status}'`,
      HTTP_STATUS.BAD_REQUEST
    );
  }

  booking.status = body.status as ServiceBookingStatus;
  if (body.adminNotes !== undefined) booking.adminNotes = body.adminNotes;
  await booking.save();

  await booking.populate('serviceId', SERVICE_POPULATE);
  await booking.populate('clientId', CLIENT_POPULATE);

  return sendSuccess(res, 'Status updated', { booking }) as any;
});

export const cancelMyServiceBooking = asyncHandler(async (req: RequestWithUser, res: Response): Promise<void> => {
  const booking = await ServiceBooking.findOne({ _id: req.params.bookingId, clientId: req.user?._id });
  if (!booking) throw new AppError('Booking not found', HTTP_STATUS.NOT_FOUND);
  if (!(['pending', 'confirmed'] as ServiceBookingStatus[]).includes(booking.status)) {
    throw new AppError(
      booking.status === 'completed' ? 'Cannot cancel a completed booking' : 'Booking is already cancelled',
      HTTP_STATUS.BAD_REQUEST
    );
  }
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
