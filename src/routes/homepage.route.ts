import { Router } from 'express';
import { getHomepageSettings, updateHeroBanner, updatePromotionalBanner, uploadHomepageImage } from '../controllers/homepage.controller';
import { authenticate, authorize } from '../middlewares/auth';
import { uploadProductImages } from '../middlewares/fileUpload';
import { UserRole } from '../types/index';

const router = Router();

router.get('/settings', getHomepageSettings);
router.put('/hero', authenticate, authorize(UserRole.ADMIN), updateHeroBanner);
router.put('/promotional-banner', authenticate, authorize(UserRole.ADMIN), updatePromotionalBanner);
router.post('/upload-image', authenticate, authorize(UserRole.ADMIN), uploadProductImages.single('image'), uploadHomepageImage);

export default router;
