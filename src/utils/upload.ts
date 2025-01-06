import { storage, getBucket } from '../lib/firebase-admin';
import { ApiError } from './ApiError';

export const uploadToFirebase = async (file: Express.Multer.File, customPath?: string): Promise<{ url: string, path: string }> => {
  try {
    const bucket = getBucket();

    if (!file || !file.buffer) {
      console.error('Invalid file object:', file);
      throw new ApiError('Invalid file object provided', 400);
    }

    console.log('Starting file upload to Firebase...', {
      originalName: file.originalname,
      mimeType: file.mimetype,
      size: file.size,
      customPath,
      bufferLength: file.buffer.length,
      bucketName: bucket.name
    });

    // Use custom path if provided, otherwise generate a default one
    const fileName = customPath || `products/${Date.now()}-${file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
    console.log('Generated file name:', fileName);

    const fileUpload = bucket.file(fileName);
    console.log('Created file reference in bucket');

    // Create write stream with detailed options
    const blobStream = fileUpload.createWriteStream({
      metadata: {
        contentType: file.mimetype,
      },
      resumable: false,
      validation: 'crc32c'
    });

    // Handle errors during upload
    return new Promise((resolve, reject) => {
      blobStream.on('error', (error) => {
        console.error('Error in blob stream:', {
          error: error.message,
          code: error.code,
          details: error.details,
          stack: error.stack
        });
        reject(new ApiError(`Upload stream error: ${error.message}`, 500));
      });

      blobStream.on('finish', async () => {
        try {
          console.log('File stream finished, making file public...');
          await fileUpload.makePublic();
          
          // Get public URL with correct Firebase Storage URL format
          const publicUrl = `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encodeURIComponent(fileName)}?alt=media`;
          console.log('File uploaded successfully. URL:', publicUrl);
          
          resolve({ url: publicUrl, path: fileName });
        } catch (error) {
          const err = error as Error;
          console.error('Error making file public:', {
            message: err.message,
            stack: err.stack,
            name: err.name
          });
          reject(new ApiError(`Failed to make file public: ${err.message}`, 500));
        }
      });

      console.log('Writing file buffer to stream...');
      blobStream.end(file.buffer);
    });
  } catch (error) {
    const err = error as Error;
    console.error('Error in uploadToFirebase:', {
      message: err.message,
      stack: err.stack,
      name: err.name
    });
    throw error instanceof ApiError ? error : new ApiError(`Failed to upload file: ${err.message}`, 500);
  }
};

export const deleteFromFirebase = async (fileUrl: string): Promise<void> => {
  try {
    console.log('Deleting file from Firebase:', fileUrl);
    const bucket = getBucket();

    // Extract the file path from the Firebase Storage URL
    let fileName = '';
    if (fileUrl.startsWith('https://firebasestorage.googleapis.com')) {
      // Extract the path after /o/
      const matches = fileUrl.match(/\/o\/([^?]+)/);
      if (matches && matches[1]) {
        fileName = decodeURIComponent(matches[1]);
      } else {
        throw new ApiError('Invalid Firebase Storage URL format', 400);
      }
    } else {
      fileName = fileUrl;
    }

    console.log('Extracted file name:', fileName);

    const file = bucket.file(fileName);
    const [exists] = await file.exists();
    
    if (exists) {
      console.log('File exists, deleting...');
      await file.delete();
      console.log('File deleted successfully');
    } else {
      console.warn('File does not exist in storage:', fileName);
      // Don't throw an error if file doesn't exist, as it might have been deleted already
    }
  } catch (error) {
    const err = error as Error;
    console.error('Error deleting file from Firebase:', {
      url: fileUrl,
      message: err.message,
      stack: err.stack,
      name: err.name
    });
    throw new ApiError(`Failed to delete file: ${err.message}`, 500);
  }
};
