import { Router } from 'express';
import { authenticate } from '../middlewares/auth';
import {
  createDeliveryAddress,
  getDeliveryAddresses,
  getDeliveryAddress,
  updateDeliveryAddress,
  deleteDeliveryAddress,
  setDefaultDeliveryAddress,
} from '../controllers/deliveryAddress.controller';

const deliveryAddressRouter = Router();

// Require authentication for all delivery address routes
deliveryAddressRouter.use(authenticate);

deliveryAddressRouter.post('/', createDeliveryAddress);
deliveryAddressRouter.get('/', getDeliveryAddresses);
deliveryAddressRouter.get('/:addressId', getDeliveryAddress);
deliveryAddressRouter.put('/:addressId', updateDeliveryAddress);
deliveryAddressRouter.delete('/:addressId', deleteDeliveryAddress);
deliveryAddressRouter.patch('/:addressId/set-default', setDefaultDeliveryAddress);

export default deliveryAddressRouter;
