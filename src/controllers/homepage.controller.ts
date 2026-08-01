import { Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import { sendSuccess } from '../utils/apiResponse';
import { HTTP_STATUS } from '../constants/app.constants';
import { AppError } from '../utils/appError';
import { RequestWithUser } from '../middlewares/auth';
import HomepageSettings from '../models/HomepageSettings';

const getOrCreateHomepageSettings = async () => {
  const existingSettings = await HomepageSettings.findOne();
  if (existingSettings) return existingSettings;

  return HomepageSettings.create({});
};

const getHomepageSettings = asyncHandler(async (_req: RequestWithUser, res: Response): Promise<void> => {
  const settings = await getOrCreateHomepageSettings();
  return sendSuccess(res, 'Homepage settings fetched successfully', { settings }, HTTP_STATUS.OK) as any;
});

const updateHeroBanner = asyncHandler(async (req: RequestWithUser, res: Response): Promise<void> => {
  const settings = await getOrCreateHomepageSettings();
  const {
    eyebrow,
    title,
    subtitle,
    ctaLabel,
    ctaLink,
    imageUrl,
    eyebrowFontSize,
    titleFontSize,
    subtitleFontSize,
    ctaFontSize,
  } = req.body;

  if (eyebrow !== undefined) settings.set('hero.eyebrow', eyebrow);
  if (title !== undefined) settings.set('hero.title', title);
  if (subtitle !== undefined) settings.set('hero.subtitle', subtitle);
  if (ctaLabel !== undefined) settings.set('hero.ctaLabel', ctaLabel);
  if (ctaLink !== undefined) settings.set('hero.ctaLink', ctaLink);
  if (imageUrl !== undefined) settings.set('hero.imageUrl', imageUrl);
  if (eyebrowFontSize !== undefined) settings.set('hero.eyebrowFontSize', eyebrowFontSize);
  if (titleFontSize !== undefined) settings.set('hero.titleFontSize', titleFontSize);
  if (subtitleFontSize !== undefined) settings.set('hero.subtitleFontSize', subtitleFontSize);
  if (ctaFontSize !== undefined) settings.set('hero.ctaFontSize', ctaFontSize);

  await settings.save();

  return sendSuccess(res, 'Hero banner updated successfully', { settings }, HTTP_STATUS.OK) as any;
});

const updatePromotionalBanner = asyncHandler(async (req: RequestWithUser, res: Response): Promise<void> => {
  const settings = await getOrCreateHomepageSettings();
  const { text, link, isVisible, fontSize } = req.body;

  if (text !== undefined) settings.set('promotionalBanner.text', text);
  if (link !== undefined) settings.set('promotionalBanner.link', link);
  if (isVisible !== undefined) settings.set('promotionalBanner.isVisible', isVisible);
  if (fontSize !== undefined) settings.set('promotionalBanner.fontSize', fontSize);

  await settings.save();

  return sendSuccess(res, 'Promotional banner updated successfully', { settings }, HTTP_STATUS.OK) as any;
});

const updateSectionOrder = asyncHandler(async (req: RequestWithUser, res: Response): Promise<void> => {
  const settings = await getOrCreateHomepageSettings();
  const { sectionOrder } = req.body as { sectionOrder?: Array<{ id: string; label: string }> };

  if (!Array.isArray(sectionOrder) || sectionOrder.length === 0) {
    throw new AppError('sectionOrder must be a non-empty array', HTTP_STATUS.BAD_REQUEST);
  }

  settings.sectionOrder = sectionOrder.map((item) => ({
    id: item.id,
    label: item.label,
  }));

  await settings.save();

  return sendSuccess(res, 'Homepage section order updated successfully', { settings }, HTTP_STATUS.OK) as any;
});

const uploadHomepageImage = asyncHandler(async (req: RequestWithUser, res: Response): Promise<void> => {
  if (!req.file) {
    throw new AppError('No homepage image uploaded', HTTP_STATUS.BAD_REQUEST);
  }

  const image = {
    filename: req.file.filename,
    path: `homepage/${req.file.filename}`,
    mimetype: req.file.mimetype,
  };

  return sendSuccess(res, 'Homepage image uploaded successfully', { image }, HTTP_STATUS.OK) as any;
});

export { getHomepageSettings, updateHeroBanner, updatePromotionalBanner, updateSectionOrder, uploadHomepageImage };
