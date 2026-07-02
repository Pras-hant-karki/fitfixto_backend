import { Router } from 'express';
import {
  cancelMyServiceBooking,
  createServiceBooking,
  getAllServiceBookings,
  getMyServiceBookings,
  updateServiceBookingStatus,
  submitServiceClientReview,
} from '../controllers/serviceBooking.controller';
import { authenticate, authorize } from '../middlewares/auth';
import { validateBody, validateParams } from '../middlewares/validation';
import { UserRole } from '../types/index';
import {
  createServiceBookingSchema,
  serviceBookingIdParamSchema,
  updateServiceBookingStatusSchema,
} from '../validations/serviceBooking.validation';

const router = Router();

router.post('/', authenticate, validateBody(createServiceBookingSchema), createServiceBooking);
router.get('/my', authenticate, getMyServiceBookings);
router.get('/', authenticate, authorize(UserRole.ADMIN), getAllServiceBookings);
router.patch(
  '/:bookingId/status',
  authenticate,
  authorize(UserRole.ADMIN),
  validateParams(serviceBookingIdParamSchema),
  validateBody(updateServiceBookingStatusSchema),
  updateServiceBookingStatus
);
router.patch(
  '/:bookingId/cancel',
  authenticate,
  validateParams(serviceBookingIdParamSchema),
  cancelMyServiceBooking
);
router.patch(
  '/:bookingId/review',
  authenticate,
  validateParams(serviceBookingIdParamSchema),
  submitServiceClientReview
);

export default router;
