import { Router } from 'express';
import {
  cancelMyBooking,
  createBooking,
  getMyClientBookings,
  getMyClients,
  getMyTrainerBookings,
  updateBookingStatus,
} from '../controllers/booking.controller';
import { authenticate, authorize } from '../middlewares/auth';
import { validateBody, validateParams } from '../middlewares/validation';
import {
  bookingIdParamSchema,
  createBookingSchema,
  updateBookingStatusSchema,
} from '../validations/booking.validation';
import { UserRole } from '../types/index';

const router = Router();

router.post('/', authenticate, validateBody(createBookingSchema), createBooking);
router.get('/my', authenticate, getMyClientBookings);
router.get('/trainer', authenticate, authorize(UserRole.TRAINER), getMyTrainerBookings);
router.get('/trainer/clients', authenticate, authorize(UserRole.TRAINER), getMyClients);
router.patch(
  '/:bookingId/status',
  authenticate,
  authorize(UserRole.TRAINER),
  validateParams(bookingIdParamSchema),
  validateBody(updateBookingStatusSchema),
  updateBookingStatus
);
router.patch(
  '/:bookingId/cancel',
  authenticate,
  validateParams(bookingIdParamSchema),
  cancelMyBooking
);

export default router;
