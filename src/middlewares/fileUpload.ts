import multer, { StorageEngine, Multer } from 'multer';
import path from 'path';
import fs from 'fs';
import env from '../config/env';
import { AppError } from '../utils/appError';
import { HTTP_STATUS } from '../constants/app.constants';

const uploadDir = env.UPLOAD_DIR;

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

// File filter
const fileFilter = (req: any, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  // Allowed file types for profile images
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

// Configure multer
const uploadProfileImage: Multer = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: env.MAX_FILE_SIZE,
  },
});

export { uploadProfileImage };
