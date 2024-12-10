import dotenv from 'dotenv';
import app from './app.js';

// Load environment variables before any other code
dotenv.config();

const PORT = process.env.PORT || 3001;

process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (error) => {
  console.error('Unhandled Rejection:', error);
  process.exit(1);
});

async function startServer() {
  try {
    app.listen(PORT, () => {
      console.log(`✨ Server is running on port ${PORT}`);
      console.log(`🚀 API Documentation available at http://localhost:${PORT}/api-docs`);
    });
  } catch (error) {
    console.error('Error starting server:', error);
    process.exit(1);
  }
}

startServer();
