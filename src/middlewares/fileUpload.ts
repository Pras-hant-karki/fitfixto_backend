import multer, { StorageEngine, Multer } from 'multer';
import path from 'path';
import fs from 'fs';
import env from '../config/env';
import { AppError } from '../utils/appError';
import { resolveUploadDir } from '../utils/uploadPath';
import { HTTP_STATUS } from '../constants/app.constants';

const baseDir = resolveUploadDir(env.UPLOAD_DIR);

const subdirs = ['products', 'trainers', 'users', 'gyms', 'services', 'homepage'] as const;
type Subdir = typeof subdirs[number];

for (const sub of subdirs) {
  const dir = path.join(baseDir, sub);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

const makeStorage = (subdir: Subdir): StorageEngine =>
  multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, path.join(baseDir, subdir)),
    filename: (_req, file, cb) => {
      const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
      const ext = path.extname(file.originalname);
      const name = path.basename(file.originalname, ext).replace(/\s+/g, '-');
      cb(null, `${name}-${uniqueSuffix}${ext}`);
    },
  });

const imageFilter = (_req: any, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  if (['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new AppError('Only image files (JPEG, PNG, WebP, GIF) are allowed', HTTP_STATUS.BAD_REQUEST));
  }
};

const applicationFilter = (_req: any, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  if (['image/jpeg', 'image/png', 'image/webp', 'application/pdf'].includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new AppError('Only JPEG, PNG, WebP, and PDF files are allowed', HTTP_STATUS.BAD_REQUEST));
  }
};

const makeUploader = (subdir: Subdir, filter = imageFilter): Multer =>
  multer({ storage: makeStorage(subdir), fileFilter: filter, limits: { fileSize: env.MAX_FILE_SIZE } });

export const uploadProfileImage = makeUploader('users');
export const uploadProductImages = makeUploader('products');
export const uploadPartnerGymImages = makeUploader('gyms');
export const uploadTrainerProgramImage = makeUploader('trainers');
export const uploadHomepageImage = makeUploader('homepage');
export const uploadServiceImage = makeUploader('services');

export const uploadTrainerApplicationFiles = multer({
  storage: makeStorage('trainers'),
  fileFilter: applicationFilter,
  limits: { fileSize: env.MAX_FILE_SIZE, files: 6 },
});
