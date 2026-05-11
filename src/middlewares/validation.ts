import { Request, Response, NextFunction, RequestHandler } from 'express';
import { ZodSchema, ZodError } from 'zod';
import { AppError } from '../utils/appError';
import { HTTP_STATUS } from '../constants/app.constants';

type ValidationSource = 'body' | 'query' | 'params';

interface ValidateOptions {
  body?: ZodSchema;
  query?: ZodSchema;
  params?: ZodSchema;
}

/**
 * Validates request data against provided Zod schemas
 * @param options - Object containing Zod schemas for body, query, and/or params
 * @returns Express middleware function
 */
const validate = (options: ValidateOptions): RequestHandler => {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const dataToValidate: Record<string, any> = {};
      const schemas: Record<string, ZodSchema> = {};

      if (options.body) {
        schemas.body = options.body;
        dataToValidate.body = req.body;
      }

      if (options.query) {
        schemas.query = options.query;
        dataToValidate.query = req.query;
      }

      if (options.params) {
        schemas.params = options.params;
        dataToValidate.params = req.params;
      }

      // Validate each schema
      const validationResults: Record<string, any> = {};
      const errors: Record<string, any> = {};

      for (const [source, schema] of Object.entries(schemas)) {
        const result = schema.safeParse(dataToValidate[source]);

        if (!result.success) {
          errors[source] = result.error.flatten().fieldErrors;
        } else {
          validationResults[source] = result.data;
        }
      }

      // If there are errors, throw AppError
      if (Object.keys(errors).length > 0) {
        const errorMessages = Object.entries(errors)
          .flatMap(([source, sourceErrors]) => {
            if (typeof sourceErrors === 'object' && sourceErrors !== null) {
              return Object.entries(sourceErrors as Record<string, any>).map(
                ([field, messages]) => {
                  const msgArray = Array.isArray(messages) ? messages : [messages];
                  return `${source}.${field}: ${msgArray.join(', ')}`;
                }
              );
            }
            return [];
          })
          .join('; ');

        throw new AppError(
          `Validation error: ${errorMessages}`,
          HTTP_STATUS.BAD_REQUEST
        );
      }

      // Attach validated data to request object
      if (validationResults.body) {
        req.body = validationResults.body;
      }
      if (validationResults.query) {
        req.query = validationResults.query as any;
      }
      if (validationResults.params) {
        req.params = validationResults.params as any;
      }

      next();
    } catch (error) {
      next(error);
    }
  };
};

/**
 * Validates only request body against a Zod schema
 * @param schema - Zod schema to validate against
 * @returns Express middleware function
 */
const validateBody = (schema: ZodSchema): RequestHandler => {
  return validate({ body: schema });
};

/**
 * Validates only query parameters against a Zod schema
 * @param schema - Zod schema to validate against
 * @returns Express middleware function
 */
const validateQuery = (schema: ZodSchema): RequestHandler => {
  return validate({ query: schema });
};

/**
 * Validates only route parameters against a Zod schema
 * @param schema - Zod schema to validate against
 * @returns Express middleware function
 */
const validateParams = (schema: ZodSchema): RequestHandler => {
  return validate({ params: schema });
};

export { validate, validateBody, validateQuery, validateParams };
