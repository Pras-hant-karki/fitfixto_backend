import { Router } from 'express';
import {
  createProduct,
  listProducts,
  getProduct,
  updateProduct,
  deleteProduct,
  uploadProductImages,
  compareProducts,
} from '../controllers/product.controller';
import { validateBody, validateParams, validateQuery } from '../middlewares/validation';
import {
  createProductSchema,
  updateProductSchema,
  productIdParamSchema,
  productListQuerySchema,
  compareProductsQuerySchema,
} from '../validations/product.validation';
import { authenticate, authorize } from '../middlewares/auth';
import { uploadProductImages as uploadProductImagesMiddleware } from '../middlewares/fileUpload';
import { UserRole } from '../types/index';

const router = Router();

router.post('/', authenticate, authorize(UserRole.SELLER, UserRole.ADMIN), validateBody(createProductSchema), createProduct);
router.get('/', validateQuery(productListQuerySchema), listProducts);
router.get('/compare', validateQuery(compareProductsQuerySchema), compareProducts);
router.get('/:productId', validateParams(productIdParamSchema), getProduct);
router.put('/:productId', authenticate, authorize(UserRole.SELLER, UserRole.ADMIN), validateParams(productIdParamSchema), validateBody(updateProductSchema), updateProduct);
router.delete('/:productId', authenticate, authorize(UserRole.SELLER, UserRole.ADMIN), validateParams(productIdParamSchema), deleteProduct);
router.post('/upload-images', authenticate, authorize(UserRole.SELLER, UserRole.ADMIN), uploadProductImagesMiddleware.array('images', 10), uploadProductImages);

export default router;
