import app from './app';
import dotenv from 'dotenv';
import { initializeCategories } from './controllers/category.controller';

dotenv.config();

const PORT = process.env.PORT || 3001;

// Initialize fixed categories
initializeCategories()
  .then(() => {
    console.log('Categories initialized successfully');
  })
  .catch((error) => {
    console.error('Error initializing categories:', error);
  });

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
