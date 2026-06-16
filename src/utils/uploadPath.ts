import path from 'path';

const resolveUploadDir = (uploadDir: string) => {
  if (path.isAbsolute(uploadDir)) {
    return uploadDir;
  }

  return path.resolve(__dirname, '..', '..', uploadDir);
};

export { resolveUploadDir };
