import { Router } from 'express';
import {
  createPartnerGym,
  deletePartnerGym,
  listPartnerGyms,
  listPublicPartnerGyms,
  updatePartnerGym,
} from '../controllers/partnerGym.controller';
import { authenticate, authorize } from '../middlewares/auth';
import { validateBody, validateParams } from '../middlewares/validation';
import { UserRole } from '../types/index';
import {
  createPartnerGymSchema,
  partnerGymIdParamSchema,
  updatePartnerGymSchema,
} from '../validations/partnerGym.validation';

const router = Router();

router.get('/public', listPublicPartnerGyms);
router.get('/', authenticate, authorize(UserRole.ADMIN), listPartnerGyms);
router.post('/', authenticate, authorize(UserRole.ADMIN), validateBody(createPartnerGymSchema), createPartnerGym);
router.put(
  '/:gymId',
  authenticate,
  authorize(UserRole.ADMIN),
  validateParams(partnerGymIdParamSchema),
  validateBody(updatePartnerGymSchema),
  updatePartnerGym
);
router.delete(
  '/:gymId',
  authenticate,
  authorize(UserRole.ADMIN),
  validateParams(partnerGymIdParamSchema),
  deletePartnerGym
);

export default router;
