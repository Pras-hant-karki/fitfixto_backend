import { Router } from 'express';
import { createTrainer, deleteTrainer, listTrainers, updateTrainer, uploadTrainerPhoto } from '../controllers/trainer.controller';
import { authenticate, authorize } from '../middlewares/auth';
import { uploadProfileImage } from '../middlewares/fileUpload';
import { validateBody, validateParams } from '../middlewares/validation';
import { createTrainerSchema, trainerIdParamSchema, updateTrainerSchema } from '../validations/trainer.validation';
import { UserRole } from '../types/index';

const router = Router();

router.get('/', authenticate, authorize(UserRole.ADMIN), listTrainers);
router.post('/', authenticate, authorize(UserRole.ADMIN), validateBody(createTrainerSchema), createTrainer);
router.post('/upload-photo', authenticate, authorize(UserRole.ADMIN), uploadProfileImage.single('photo'), uploadTrainerPhoto);
router.put('/:trainerId', authenticate, authorize(UserRole.ADMIN), validateParams(trainerIdParamSchema), validateBody(updateTrainerSchema), updateTrainer);
router.delete('/:trainerId', authenticate, authorize(UserRole.ADMIN), validateParams(trainerIdParamSchema), deleteTrainer);

export default router;
