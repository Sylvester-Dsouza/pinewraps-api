import { Request, Response, NextFunction } from 'express';
import { ApiError } from '../utils/ApiError';
import { Prisma } from '@prisma/client';
import { ZodError } from 'zod';

export const errorHandler = (
  err: Error | ApiError | Prisma.PrismaClientKnownRequestError | ZodError,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  console.error('Error:', err);

  // Handle ApiError
  if (err instanceof ApiError) {
    return res.status(err.statusCode).json({
      error: err.message,
      details: err.details
    });
  }

  // Handle Prisma Errors
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    let statusCode = 500;
    let message = 'Database operation failed';

    switch (err.code) {
      case 'P2002':
        statusCode = 409;
        message = 'A record with this value already exists';
        break;
      case 'P2025':
        statusCode = 404;
        message = 'Record not found';
        break;
      case 'P2014':
        statusCode = 400;
        message = 'Invalid ID or reference';
        break;
      case 'P2003':
        statusCode = 400;
        message = 'Foreign key constraint failed';
        break;
    }

    return res.status(statusCode).json({
      error: message,
      code: err.code,
      meta: err.meta
    });
  }

  // Handle Zod Validation Errors
  if (err instanceof ZodError) {
    return res.status(400).json({
      error: 'Validation failed',
      details: err.errors
    });
  }

  // Handle all other errors
  console.error('Unhandled error:', err);
  return res.status(500).json({
    error: 'Internal server error'
  });
};
