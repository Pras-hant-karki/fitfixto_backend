import { Response } from 'express';
import { Types } from 'mongoose';
import { HTTP_STATUS } from '../constants/app.constants';
import { RequestWithUser } from '../middlewares/auth';
import DiscountSettings from '../models/DiscountSettings';
import Bundle from '../models/Bundle';
import { AppError } from '../utils/appError';
import { sendSuccess } from '../utils/apiResponse';
import { asyncHandler } from '../utils/asyncHandler';

const PRODUCT_FIELDS = 'name images price category';

// Ensure a singleton DiscountSettings document always exists
const getOrCreateSettings = async () => {
  const existing = await DiscountSettings.findOne({})
    .populate('flashSale.productIds', PRODUCT_FIELDS)
    .populate('bestPriceProductIds', PRODUCT_FIELDS);
  if (existing) return existing;
  const fresh = await DiscountSettings.create({});
  return DiscountSettings.findById(fresh._id)
    .populate('flashSale.productIds', PRODUCT_FIELDS)
    .populate('bestPriceProductIds', PRODUCT_FIELDS);
};

// ── PUBLIC ────────────────────────────────────────────────────────────────────

export const getPublicDiscounts = asyncHandler(async (_req, res: Response): Promise<void> => {
  const [settings, bundles] = await Promise.all([
    getOrCreateSettings(),
    Bundle.find({ isActive: true })
      .sort({ createdAt: -1 })
      .populate('productIds', PRODUCT_FIELDS),
  ]);

  return sendSuccess(res, 'Discounts fetched', {
    flashSale: settings?.flashSale ?? null,
    bestPriceProductIds: settings?.bestPriceProductIds ?? [],
    refundGuarantee: settings?.refundGuarantee ?? '',
    bundles,
  }) as any;
});

// ── ADMIN ─────────────────────────────────────────────────────────────────────

export const getAdminDiscounts = asyncHandler(async (_req, res: Response): Promise<void> => {
  const [settings, bundles] = await Promise.all([
    getOrCreateSettings(),
    Bundle.find()
      .sort({ createdAt: -1 })
      .populate('productIds', PRODUCT_FIELDS),
  ]);

  return sendSuccess(res, 'Admin discounts fetched', {
    flashSale: settings?.flashSale ?? null,
    bestPriceProductIds: settings?.bestPriceProductIds ?? [],
    refundGuarantee: settings?.refundGuarantee ?? '',
    bundles,
  }) as any;
});

export const updateFlashSale = asyncHandler(async (req: RequestWithUser, res: Response): Promise<void> => {
  if (!req.user) throw new AppError('Not authenticated', HTTP_STATUS.UNAUTHORIZED);

  const { productIds, endsAt, ...rest } = req.body;

  const update: Record<string, unknown> = {};
  if (rest.title !== undefined) update['flashSale.title'] = rest.title;
  if (rest.discountPercentage !== undefined) update['flashSale.discountPercentage'] = rest.discountPercentage;
  if (rest.isActive !== undefined) update['flashSale.isActive'] = rest.isActive;
  if (endsAt !== undefined) update['flashSale.endsAt'] = endsAt ? new Date(endsAt) : null;
  if (productIds !== undefined) {
    update['flashSale.productIds'] = productIds.map((id: string) => new Types.ObjectId(id));
  }

  await getOrCreateSettings();
  const settings = await DiscountSettings.findOneAndUpdate(
    {},
    { $set: update },
    { new: true }
  )
    .populate('flashSale.productIds', PRODUCT_FIELDS)
    .populate('bestPriceProductIds', PRODUCT_FIELDS);

  return sendSuccess(res, 'Flash sale updated', { flashSale: settings?.flashSale }) as any;
});

export const updateBestPrice = asyncHandler(async (req: RequestWithUser, res: Response): Promise<void> => {
  if (!req.user) throw new AppError('Not authenticated', HTTP_STATUS.UNAUTHORIZED);

  const productIds = (req.body.productIds as string[]).map((id) => new Types.ObjectId(id));

  await getOrCreateSettings();
  const settings = await DiscountSettings.findOneAndUpdate(
    {},
    { $set: { bestPriceProductIds: productIds } },
    { new: true }
  ).populate('bestPriceProductIds', PRODUCT_FIELDS);

  return sendSuccess(res, 'Best-price labels updated', { bestPriceProductIds: settings?.bestPriceProductIds }) as any;
});

export const updateRefundGuarantee = asyncHandler(async (req: RequestWithUser, res: Response): Promise<void> => {
  if (!req.user) throw new AppError('Not authenticated', HTTP_STATUS.UNAUTHORIZED);

  await getOrCreateSettings();
  const settings = await DiscountSettings.findOneAndUpdate(
    {},
    { $set: { refundGuarantee: req.body.refundGuarantee } },
    { new: true }
  );

  return sendSuccess(res, 'Refund guarantee updated', { refundGuarantee: settings?.refundGuarantee }) as any;
});

// ── BUNDLES ───────────────────────────────────────────────────────────────────

export const createBundle = asyncHandler(async (req: RequestWithUser, res: Response): Promise<void> => {
  if (!req.user) throw new AppError('Not authenticated', HTTP_STATUS.UNAUTHORIZED);

  const bundle = await Bundle.create({
    ...req.body,
    productIds: req.body.productIds.map((id: string) => new Types.ObjectId(id)),
  });

  await bundle.populate('productIds', PRODUCT_FIELDS);

  return sendSuccess(res, 'Bundle created', { bundle }, HTTP_STATUS.CREATED) as any;
});

export const updateBundle = asyncHandler(async (req: RequestWithUser, res: Response): Promise<void> => {
  if (!req.user) throw new AppError('Not authenticated', HTTP_STATUS.UNAUTHORIZED);

  const body = { ...req.body };
  if (body.productIds) body.productIds = body.productIds.map((id: string) => new Types.ObjectId(id));

  const bundle = await Bundle.findByIdAndUpdate(req.params.bundleId, body, {
    new: true,
    runValidators: true,
  }).populate('productIds', PRODUCT_FIELDS);

  if (!bundle) throw new AppError('Bundle not found', HTTP_STATUS.NOT_FOUND);

  return sendSuccess(res, 'Bundle updated', { bundle }) as any;
});

export const deleteBundle = asyncHandler(async (req: RequestWithUser, res: Response): Promise<void> => {
  if (!req.user) throw new AppError('Not authenticated', HTTP_STATUS.UNAUTHORIZED);

  const bundle = await Bundle.findByIdAndDelete(req.params.bundleId);
  if (!bundle) throw new AppError('Bundle not found', HTTP_STATUS.NOT_FOUND);

  return sendSuccess(res, 'Bundle deleted', { bundleId: req.params.bundleId }) as any;
});
