import { Request, Response, NextFunction } from 'express';
import { AnyZodObject, ZodError } from 'zod';

export const validateRequest = (schema: AnyZodObject) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      // Log the raw request body
      console.log('Raw request body:', req.body);
      
      // Log the content type
      console.log('Content-Type:', req.headers['content-type']);

      // Validate the request data
      const validData = await schema.parseAsync(req.body);
      
      // Log the validated data
      console.log('Validated data:', validData);
      
      // Attach validated data to request
      req.body = validData;
      
      next();
    } catch (error) {
      console.error('Validation error:', error);

      if (error instanceof ZodError) {
        return res.status(400).json({
          success: false,
          error: 'Validation failed',
          details: error.errors.map(err => ({
            path: err.path.join('.'),
            message: err.message
          }))
        });
      }

      return res.status(400).json({
        success: false,
        error: 'Invalid request data',
        message: error instanceof Error ? error.message : 'Unknown validation error'
      });
    }
  };
};
