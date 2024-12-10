import { Request, Response, NextFunction } from 'express';

// Middleware to handle async route handlers
export const asyncHandler = (fn: Function) => (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
};
