import { Router } from 'express';
import {
  approveTrainerApplication,
  createTrainer,
  createTrainerApplication,
  createTrainerProgram,
  deleteTrainer,
  deleteTrainerProgram,
  getPublicTrainer,
  listMyTrainerPrograms,
  listPublicTrainerPrograms,
  listTrainerApplications,
  listPublicTrainers,
  listTrainers,
  rejectTrainerApplication,
  updateTrainer,
  updateTrainerProgram,
  uploadTrainerPhoto,
} from '../controllers/trainer.controller';
import { authenticate, authorize } from '../middlewares/auth';
import { uploadProfileImage } from '../middlewares/fileUpload';
import { validateBody, validateParams } from '../middlewares/validation';
import {
  createTrainerSchema,
  trainerApplicationIdParamSchema,
  trainerApplicationSchema,
  trainerIdParamSchema,
  trainerProgramIdParamSchema,
  trainerProgramSchema,
  updateTrainerSchema,
  updateTrainerProgramSchema,
} from '../validations/trainer.validation';
import { UserRole } from '../types/index';

const router = Router();

router.post('/applications', validateBody(trainerApplicationSchema), createTrainerApplication);
router.get('/public', listPublicTrainers);
router.get('/public/:trainerId/programs', validateParams(trainerIdParamSchema), listPublicTrainerPrograms);
router.get('/public/:trainerId', validateParams(trainerIdParamSchema), getPublicTrainer);
router.get('/applications', authenticate, authorize(UserRole.ADMIN), listTrainerApplications);
router.patch('/applications/:applicationId/approve', authenticate, authorize(UserRole.ADMIN), validateParams(trainerApplicationIdParamSchema), approveTrainerApplication);
router.patch('/applications/:applicationId/reject', authenticate, authorize(UserRole.ADMIN), validateParams(trainerApplicationIdParamSchema), rejectTrainerApplication);
router.get('/programs/me', authenticate, authorize(UserRole.TRAINER), listMyTrainerPrograms);
router.post('/programs', authenticate, authorize(UserRole.TRAINER), validateBody(trainerProgramSchema), createTrainerProgram);
router.put(
  '/programs/:programId',
  authenticate,
  authorize(UserRole.TRAINER),
  validateParams(trainerProgramIdParamSchema),
  validateBody(updateTrainerProgramSchema),
  updateTrainerProgram
);
router.delete('/programs/:programId', authenticate, authorize(UserRole.TRAINER), validateParams(trainerProgramIdParamSchema), deleteTrainerProgram);
router.get('/', authenticate, authorize(UserRole.ADMIN), listTrainers);
router.post('/', authenticate, authorize(UserRole.ADMIN), validateBody(createTrainerSchema), createTrainer);
router.post('/upload-photo', authenticate, authorize(UserRole.ADMIN), uploadProfileImage.single('photo'), uploadTrainerPhoto);
router.put('/:trainerId', authenticate, authorize(UserRole.ADMIN), validateParams(trainerIdParamSchema), validateBody(updateTrainerSchema), updateTrainer);
router.delete('/:trainerId', authenticate, authorize(UserRole.ADMIN), validateParams(trainerIdParamSchema), deleteTrainer);

export default router;
