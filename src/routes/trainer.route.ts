import { Router } from 'express';
import {
  approveTrainerApplication,
  createTrainer,
  createTrainerApplication,
  createTrainerAvailability,
  createTrainerProgram,
  deleteTrainer,
  deleteTrainerAvailability,
  deleteTrainerProgram,
  getPublicTrainer,
  getPublicTrainerReviews,
  listMyTrainerAvailability,
  listMyTrainerCalendarAvailability,
  saveMyTrainerCalendarAvailability,
  listMyTrainerPrograms,
  listPublicTrainerAvailability,
  listPublicTrainerPrograms,
  listTrainerApplications,
  listPublicTrainers,
  listTrainers,
  rejectTrainerApplication,
  updateTrainer,
  updateTrainerAvailability,
  updateTrainerProgram,
  uploadTrainerPhoto,
  uploadTrainerApplicationFiles,
  uploadTrainerProgramImage,
} from '../controllers/trainer.controller';
import { authenticate, authorize } from '../middlewares/auth';
import { uploadTrainerProgramImage as trainerPhotoUpload, uploadTrainerApplicationFiles as trainerApplicationUpload, uploadTrainerProgramImage as trainerProgramUpload } from '../middlewares/fileUpload';
import { validateBody, validateParams } from '../middlewares/validation';
import {
  createTrainerSchema,
  trainerAvailabilityIdParamSchema,
  trainerAvailabilitySchema,
  trainerApplicationIdParamSchema,
  trainerApplicationSchema,
  trainerIdParamSchema,
  trainerProgramIdParamSchema,
  trainerProgramSchema,
  updateTrainerAvailabilitySchema,
  updateTrainerSchema,
  updateTrainerProgramSchema,
} from '../validations/trainer.validation';
import { UserRole } from '../types/index';

const router = Router();

router.post('/applications', validateBody(trainerApplicationSchema), createTrainerApplication);
router.post(
  '/applications/upload-files',
  trainerApplicationUpload.fields([
    { name: 'photo', maxCount: 1 },
    { name: 'certificates', maxCount: 5 },
  ]),
  uploadTrainerApplicationFiles
);
router.get('/public', listPublicTrainers);
router.get('/public/:trainerId/programs', validateParams(trainerIdParamSchema), listPublicTrainerPrograms);
router.get('/public/:trainerId/availability', validateParams(trainerIdParamSchema), listPublicTrainerAvailability);
router.get('/public/:trainerId/reviews', validateParams(trainerIdParamSchema), getPublicTrainerReviews);
router.get('/public/:trainerId', validateParams(trainerIdParamSchema), getPublicTrainer);
router.get('/applications', authenticate, authorize(UserRole.ADMIN), listTrainerApplications);
router.patch('/applications/:applicationId/approve', authenticate, authorize(UserRole.ADMIN), validateParams(trainerApplicationIdParamSchema), approveTrainerApplication);
router.patch('/applications/:applicationId/reject', authenticate, authorize(UserRole.ADMIN), validateParams(trainerApplicationIdParamSchema), rejectTrainerApplication);
router.get('/programs/me', authenticate, authorize(UserRole.TRAINER), listMyTrainerPrograms);
router.post('/programs', authenticate, authorize(UserRole.TRAINER), validateBody(trainerProgramSchema), createTrainerProgram);
router.post('/programs/upload-image', authenticate, authorize(UserRole.TRAINER), trainerProgramUpload.single('image'), uploadTrainerProgramImage);
router.put(
  '/programs/:programId',
  authenticate,
  authorize(UserRole.TRAINER),
  validateParams(trainerProgramIdParamSchema),
  validateBody(updateTrainerProgramSchema),
  updateTrainerProgram
);
router.delete('/programs/:programId', authenticate, authorize(UserRole.TRAINER), validateParams(trainerProgramIdParamSchema), deleteTrainerProgram);
router.get('/availability/me', authenticate, authorize(UserRole.TRAINER), listMyTrainerAvailability);
router.get('/availability/dates', authenticate, authorize(UserRole.TRAINER), listMyTrainerCalendarAvailability);
router.post('/availability/dates', authenticate, authorize(UserRole.TRAINER), saveMyTrainerCalendarAvailability);
router.post('/availability', authenticate, authorize(UserRole.TRAINER), validateBody(trainerAvailabilitySchema), createTrainerAvailability);
router.put(
  '/availability/:slotId',
  authenticate,
  authorize(UserRole.TRAINER),
  validateParams(trainerAvailabilityIdParamSchema),
  validateBody(updateTrainerAvailabilitySchema),
  updateTrainerAvailability
);
router.delete('/availability/:slotId', authenticate, authorize(UserRole.TRAINER), validateParams(trainerAvailabilityIdParamSchema), deleteTrainerAvailability);
router.get('/', authenticate, authorize(UserRole.ADMIN), listTrainers);
router.post('/', authenticate, authorize(UserRole.ADMIN), validateBody(createTrainerSchema), createTrainer);
router.post('/upload-photo', authenticate, authorize(UserRole.ADMIN), trainerPhotoUpload.single('photo'), uploadTrainerPhoto);
router.put('/:trainerId', authenticate, authorize(UserRole.ADMIN), validateParams(trainerIdParamSchema), validateBody(updateTrainerSchema), updateTrainer);
router.delete('/:trainerId', authenticate, authorize(UserRole.ADMIN), validateParams(trainerIdParamSchema), deleteTrainer);

export default router;
