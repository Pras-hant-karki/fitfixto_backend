import path from 'path';

const resolveUploadDir = (uploadDir: string) => {
  if (path.isAbsolute(uploadDir)) return uploadDir;
  return path.resolve(process.cwd(), uploadDir);
};

export { resolveUploadDir };
