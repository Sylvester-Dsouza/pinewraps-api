# Pinewraps API

Backend API for the Pinewraps application.

## Documentation

- [API Documentation](./docs/API.md) - Detailed API endpoints and usage
- [Database Schema](./prisma/schema.prisma) - Database models and relationships

## Getting Started

1. Install dependencies:
```bash
npm install
```

2. Set up environment variables:
- Copy `.env.example` to `.env`
- Add your Firebase service account credentials

3. Start the development server:
```bash
npm run dev
```

4. Test the API:
- Get a test token using `/api/test/login-test`
- Use the token to access protected endpoints

## Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm start` - Start production server

## Security Notes

- The test endpoints (`/api/test/*`) should not be exposed in production
- Ensure Firebase service account credentials are properly secured
- All sensitive operations require admin privileges
