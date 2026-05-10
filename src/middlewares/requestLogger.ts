import morgan from 'morgan';

export const requestLogger = morgan('dev', {
  skip: () => process.env.NODE_ENV === 'test',
});
