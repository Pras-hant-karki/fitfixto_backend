import { Router } from 'express';
import {
  getAdminDiscounts,
  getPublicDiscounts,
  updateFlashSale,
  updateBestPrice,
  updateRefundGuarantee,
  createBundle,
  updateBundle,
  deleteBundle,
} from '../controllers/discount.controller';
import { authenticate, authorize } from '../middlewares/auth';
import { validateBody, validateParams } from '../middlewares/validation';
import { UserRole } from '../types/index';
import {
  bundleIdParamSchema,
  createBundleSchema,
  updateBundleSchema,
  updateBestPriceSchema,
  updateFlashSaleSchema,
  updateRefundGuaranteeSchema,
} from '../validations/discount.validation';

const router = Router();

// Public
router.get('/public', getPublicDiscounts);

// Admin — settings
router.get('/', authenticate, authorize(UserRole.ADMIN), getAdminDiscounts);
router.put('/flash-sale', authenticate, authorize(UserRole.ADMIN), validateBody(updateFlashSaleSchema), updateFlashSale);
router.put('/best-price', authenticate, authorize(UserRole.ADMIN), validateBody(updateBestPriceSchema), updateBestPrice);
router.put('/refund-guarantee', authenticate, authorize(UserRole.ADMIN), validateBody(updateRefundGuaranteeSchema), updateRefundGuarantee);

// Admin — bundles
router.post('/bundles', authenticate, authorize(UserRole.ADMIN), validateBody(createBundleSchema), createBundle);
router.put('/bundles/:bundleId', authenticate, authorize(UserRole.ADMIN), validateParams(bundleIdParamSchema), validateBody(updateBundleSchema), updateBundle);
router.delete('/bundles/:bundleId', authenticate, authorize(UserRole.ADMIN), validateParams(bundleIdParamSchema), deleteBundle);

export default router;
