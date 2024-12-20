import { Request, Response, NextFunction } from 'express';

export const parseFormData = () => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      // Check if the request is multipart/form-data
      const contentType = req.headers['content-type'] || '';
      if (contentType.includes('multipart/form-data')) {
        console.log('Parsing FormData request...');
        console.log('Raw form data:', req.body);
        
        // Ensure req.body exists
        if (!req.body) {
          req.body = {};
        }

        // Parse number fields
        if (req.body.basePrice) {
          const price = parseFloat(req.body.basePrice);
          req.body.basePrice = isNaN(price) ? 0 : price;
        }

        // Parse JSON fields safely
        ['variations', 'tags'].forEach(field => {
          if (typeof req.body[field] === 'string') {
            try {
              req.body[field] = JSON.parse(req.body[field]);
            } catch (e) {
              console.warn(`Failed to parse ${field}, using default value`);
              req.body[field] = [];
            }
          } else if (req.body[field] === undefined) {
            req.body[field] = [];
          }
        });

        // Ensure status is a valid value
        if (!req.body.status) {
          req.body.status = 'DRAFT';
        }

        // Ensure required fields are strings
        ['name', 'categoryId'].forEach(field => {
          if (req.body[field]) {
            req.body[field] = String(req.body[field]).trim();
          }
        });

        console.log('Parsed form data:', req.body);
      }
      next();
    } catch (error) {
      console.error('Error parsing form data:', error);
      next(error);
    }
  };
};
