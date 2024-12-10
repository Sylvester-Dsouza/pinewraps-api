const fs = require('fs');
const path = require('path');

// Create dist/public directory
const publicDir = path.join(__dirname, '../dist/public');
if (!fs.existsSync(publicDir)) {
    fs.mkdirSync(publicDir, { recursive: true });
}

// Copy files from public to dist/public
const sourceDir = path.join(__dirname, '../public');
if (fs.existsSync(sourceDir)) {
    try {
        const files = fs.readdirSync(sourceDir);
        files.forEach(file => {
            const sourcePath = path.join(sourceDir, file);
            const destPath = path.join(publicDir, file);
            fs.copyFileSync(sourcePath, destPath);
        });
        console.log('Successfully copied public files to dist/public');
    } catch (err) {
        console.log('No files to copy from public directory');
    }
}
