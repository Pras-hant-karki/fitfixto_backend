import multer, { StorageEngine, Multer } from 'multer';
import path from 'path';
import fs from 'fs';
import env from '../config/env';
import { AppError } from '../utils/appError';
import { resolveUploadDir } from '../utils/uploadPath';
import { HTTP_STATUS } from '../constants/app.constants';

const uploadDir = resolveUploadDir(env.UPLOAD_DIR);

// Create upload directory if it doesn't exist
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Configure storage
const storage: StorageEngine = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    // Generate unique filename
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname);
    const name = path.basename(file.originalname, ext);
    cb(null, `${name}-${uniqueSuffix}${ext}`);
  },
});

const fileFilter = (_req: any, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  const allowedMimes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

  if (allowedMimes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(
      new AppError(
        'Only image files (JPEG, PNG, WebP, GIF) are allowed',
        HTTP_STATUS.BAD_REQUEST
      )
    );
  }
};

const imageUpload: Multer = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: env.MAX_FILE_SIZE,
  },
});

const uploadProfileImage = imageUpload;
const uploadProductImages = imageUpload;
const uploadPartnerGymImages = imageUpload;

const applicationFileFilter = (_req: any, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  const allowedMimes = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];

  if (allowedMimes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new AppError('Only JPEG, PNG, WebP, and PDF files are allowed', HTTP_STATUS.BAD_REQUEST));
  }
};

const uploadTrainerApplicationFiles = multer({
  storage,
  fileFilter: applicationFileFilter,
  limits: {
    fileSize: env.MAX_FILE_SIZE,
    files: 6,
  },
});

export { uploadProfileImage, uploadProductImages, uploadPartnerGymImages, uploadTrainerApplicationFiles };
