import { Router } from 'express';
import {
  createService,
  deleteService,
  listPublicServices,
  listServices,
  updateService,
  uploadServiceImage,
} from '../controllers/service.controller';
import { authenticate, authorize } from '../middlewares/auth';
import { uploadProductImages } from '../middlewares/fileUpload';
import { validateBody, validateParams } from '../middlewares/validation';
import { UserRole } from '../types/index';
import {
  createServiceSchema,
  serviceIdParamSchema,
  updateServiceSchema,
} from '../validations/service.validation';

const router = Router();

router.get('/public', listPublicServices);
router.get('/', authenticate, authorize(UserRole.ADMIN), listServices);
router.post(
  '/',
  authenticate,
  authorize(UserRole.ADMIN),
  validateBody(createServiceSchema),
  createService
);
router.post(
  '/upload-image',
  authenticate,
  authorize(UserRole.ADMIN),
  uploadProductImages.single('image'),
  uploadServiceImage
);
router.put(
  '/:serviceId',
  authenticate,
  authorize(UserRole.ADMIN),
  validateParams(serviceIdParamSchema),
  validateBody(updateServiceSchema),
  updateService
);
router.delete(
  '/:serviceId',
  authenticate,
  authorize(UserRole.ADMIN),
  validateParams(serviceIdParamSchema),
  deleteService
);

export default router;
