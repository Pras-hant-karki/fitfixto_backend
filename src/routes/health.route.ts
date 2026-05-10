import { Router } from 'express';
import { APP_CONSTANTS, HTTP_STATUS } from '../constants/app.constants';
import { sendSuccess } from '../utils/apiResponse';

const healthRouter = Router();

healthRouter.get('/', (_req, res) => {
  return sendSuccess(
    res,
    `${APP_CONSTANTS.APP_NAME} is healthy`,
    {
      status: 'ok',
      timestamp: new Date().toISOString(),
    },
    HTTP_STATUS.OK
  );
});

export default healthRouter;
