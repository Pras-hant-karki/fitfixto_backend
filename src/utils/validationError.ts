import { ZodError } from 'zod';

/**
 * Renders a Zod failure as a readable sentence.
 *
 * Using only `fieldErrors` loses whole-object problems — most importantly the unrecognized-key
 * error raised by `.strict()`, which lands in `formErrors`. That produced a bare
 * "Validation error:" with nothing after it, giving the user no idea what was wrong.
 */
export const formatZodError = (error: ZodError): string => {
  const { fieldErrors, formErrors } = error.flatten();

  const fieldMessages = Object.entries(fieldErrors).flatMap(([field, messages]) =>
    (messages ?? []).map((message) => `${field}: ${message}`)
  );

  const messages = [...fieldMessages, ...formErrors];

  return messages.length ? messages.join(', ') : 'The submitted data is invalid.';
};
