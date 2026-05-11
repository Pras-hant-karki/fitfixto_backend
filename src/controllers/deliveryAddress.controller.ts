import { Response } from 'express';
import { HTTP_STATUS } from '../constants/app.constants';
import { AppError } from '../utils/appError';
import { sendSuccess } from '../utils/apiResponse';
import { asyncHandler } from '../utils/asyncHandler';
import { RequestWithUser } from '../middlewares/auth';
import DeliveryAddress from '../models/DeliveryAddress';
import {
  createDeliveryAddressSchema,
  updateDeliveryAddressSchema,
} from '../validations/deliveryAddress.validation';

const createDeliveryAddress = asyncHandler(
  async (req: RequestWithUser, res: Response): Promise<void> => {
    if (!req.user) {
      throw new AppError('Not authenticated', HTTP_STATUS.UNAUTHORIZED);
    }

    const validationResult = createDeliveryAddressSchema.safeParse(req.body);

    if (!validationResult.success) {
      const errors = validationResult.error.flatten().fieldErrors;
      throw new AppError(
        `Validation error: ${Object.values(errors)
          .flat()
          .join(', ')}`,
        HTTP_STATUS.BAD_REQUEST
      );
    }

    const { isDefault, ...addressData } = validationResult.data;

    // If this is set as default, unset other defaults for this user
    if (isDefault) {
      await DeliveryAddress.updateMany(
        { userId: req.user._id, isDefault: true },
        { isDefault: false }
      );
    }

    const newAddress = new DeliveryAddress({
      userId: req.user._id,
      ...addressData,
      isDefault: isDefault || false,
    });

    await newAddress.save();

    return sendSuccess(
      res,
      'Delivery address created successfully',
      { address: newAddress },
      HTTP_STATUS.CREATED
    ) as any;
  }
);

const getDeliveryAddresses = asyncHandler(
  async (req: RequestWithUser, res: Response): Promise<void> => {
    if (!req.user) {
      throw new AppError('Not authenticated', HTTP_STATUS.UNAUTHORIZED);
    }

    const addresses = await DeliveryAddress.find({ userId: req.user._id }).sort({ isDefault: -1, createdAt: -1 });

    return sendSuccess(
      res,
      'Delivery addresses fetched successfully',
      { addresses },
      HTTP_STATUS.OK
    ) as any;
  }
);

const getDeliveryAddress = asyncHandler(
  async (req: RequestWithUser, res: Response): Promise<void> => {
    if (!req.user) {
      throw new AppError('Not authenticated', HTTP_STATUS.UNAUTHORIZED);
    }

    const { addressId } = req.params;

    const address = await DeliveryAddress.findOne({
      _id: addressId,
      userId: req.user._id,
    });

    if (!address) {
      throw new AppError(
        'Delivery address not found',
        HTTP_STATUS.NOT_FOUND
      );
    }

    return sendSuccess(
      res,
      'Delivery address fetched successfully',
      { address },
      HTTP_STATUS.OK
    ) as any;
  }
);

const updateDeliveryAddress = asyncHandler(
  async (req: RequestWithUser, res: Response): Promise<void> => {
    if (!req.user) {
      throw new AppError('Not authenticated', HTTP_STATUS.UNAUTHORIZED);
    }

    const validationResult = updateDeliveryAddressSchema.safeParse(req.body);

    if (!validationResult.success) {
      const errors = validationResult.error.flatten().fieldErrors;
      throw new AppError(
        `Validation error: ${Object.values(errors)
          .flat()
          .join(', ')}`,
        HTTP_STATUS.BAD_REQUEST
      );
    }

    const { addressId } = req.params;
    const { isDefault, ...updateData } = validationResult.data;

    const address = await DeliveryAddress.findOne({
      _id: addressId,
      userId: req.user._id,
    });

    if (!address) {
      throw new AppError(
        'Delivery address not found',
        HTTP_STATUS.NOT_FOUND
      );
    }

    // If setting as default, unset other defaults
    if (isDefault === true && !address.isDefault) {
      await DeliveryAddress.updateMany(
        { userId: req.user._id, isDefault: true },
        { isDefault: false }
      );
    }

    Object.assign(address, updateData);
    if (isDefault !== undefined) {
      address.isDefault = isDefault;
    }

    await address.save();

    return sendSuccess(
      res,
      'Delivery address updated successfully',
      { address },
      HTTP_STATUS.OK
    ) as any;
  }
);

const deleteDeliveryAddress = asyncHandler(
  async (req: RequestWithUser, res: Response): Promise<void> => {
    if (!req.user) {
      throw new AppError('Not authenticated', HTTP_STATUS.UNAUTHORIZED);
    }

    const { addressId } = req.params;

    const address = await DeliveryAddress.findOneAndDelete({
      _id: addressId,
      userId: req.user._id,
    });

    if (!address) {
      throw new AppError(
        'Delivery address not found',
        HTTP_STATUS.NOT_FOUND
      );
    }

    return sendSuccess(
      res,
      'Delivery address deleted successfully',
      { addressId },
      HTTP_STATUS.OK
    ) as any;
  }
);

const setDefaultDeliveryAddress = asyncHandler(
  async (req: RequestWithUser, res: Response): Promise<void> => {
    if (!req.user) {
      throw new AppError('Not authenticated', HTTP_STATUS.UNAUTHORIZED);
    }

    const { addressId } = req.params;

    const address = await DeliveryAddress.findOne({
      _id: addressId,
      userId: req.user._id,
    });

    if (!address) {
      throw new AppError(
        'Delivery address not found',
        HTTP_STATUS.NOT_FOUND
      );
    }

    // Unset all other defaults
    await DeliveryAddress.updateMany(
      { userId: req.user._id, isDefault: true },
      { isDefault: false }
    );

    // Set this as default
    address.isDefault = true;
    await address.save();

    return sendSuccess(
      res,
      'Default delivery address set successfully',
      { address },
      HTTP_STATUS.OK
    ) as any;
  }
);

export {
  createDeliveryAddress,
  getDeliveryAddresses,
  getDeliveryAddress,
  updateDeliveryAddress,
  deleteDeliveryAddress,
  setDefaultDeliveryAddress,
};
