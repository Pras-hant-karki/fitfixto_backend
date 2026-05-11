import { Router } from 'express';
import {
  createProduct,
  listProducts,
  getProduct,
  updateProduct,
  deleteProduct,
} from '../controllers/product.controller';
import { validateBody, validateParams } from '../middlewares/validation';
import { createProductSchema, updateProductSchema, productIdParamSchema } from '../validations/product.validation';

const router = Router();

router.post('/', validateBody(createProductSchema), createProduct);
router.get('/', listProducts);
router.get('/:productId', validateParams(productIdParamSchema), getProduct);
router.put('/:productId', validateParams(productIdParamSchema), validateBody(updateProductSchema), updateProduct);
router.delete('/:productId', validateParams(productIdParamSchema), deleteProduct);

export default router;
