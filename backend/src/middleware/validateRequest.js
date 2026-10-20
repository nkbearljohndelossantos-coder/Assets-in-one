const { sendError } = require('../utils/apiResponse');

/**
 * Zod validation middleware wrapper
 * @param {object} schemas - Object containing optional Zod schemas for body, query, params
 * Example: validateRequest({ body: documentSchema, query: filterSchema })
 */
function validateRequest(schemas = {}) {
  return async (req, res, next) => {
    try {
      if (schemas.body) {
        req.body = await schemas.body.parseAsync(req.body);
      }
      if (schemas.query) {
        req.query = await schemas.query.parseAsync(req.query);
      }
      if (schemas.params) {
        req.params = await schemas.params.parseAsync(req.params);
      }
      next();
    } catch (err) {
      if (err.name === 'ZodError' || err.issues) {
        const issues = err.issues || err.errors || [];
        const details = issues.map(issue => ({
          field: issue.path.join('.'),
          message: issue.message,
          code: issue.code
        }));

        return sendError(
          res,
          422,
          'VALIDATION_ERROR',
          'Request validation failed. Please check payload data types and required fields.',
          details
        );
      }

      return sendError(res, 400, 'BAD_REQUEST', err.message || 'Invalid request payload format.');
    }
  };
}

module.exports = {
  validateRequest
};
