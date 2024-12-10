export class ApiError extends Error {
  statusCode: number;

  constructor(message: string, statusCode: number = 500) {
    super(message);
    this.statusCode = statusCode;
    this.name = 'ApiError';
  }
}

// Error handler middleware
export const errorHandler = (err: any, req: any, res: any, next: any) => {
  console.error('Error:', err);

  if (err instanceof ApiError) {
    return res.status(err.statusCode).json({
      error: err.message
    });
  }

  // Handle Firebase Auth errors
  if (err.code && err.code.startsWith('auth/')) {
    return res.status(401).json({
      error: err.message
    });
  }

  // Handle Prisma errors
  if (err.code && err.code.startsWith('P')) {
    return res.status(400).json({
      error: 'Database operation failed'
    });
  }

  // Default error
  res.status(500).json({
    error: 'Internal server error'
  });
};
