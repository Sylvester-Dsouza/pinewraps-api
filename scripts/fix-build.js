const fs = require('fs');
const path = require('path');

// Create dist directory if it doesn't exist
const distDir = path.join(__dirname, '../dist');
if (!fs.existsSync(distDir)) {
    fs.mkdirSync(distDir, { recursive: true });
}

// Copy necessary files
const filesToCopy = [
    { src: '../package.json', dest: '../dist/package.json' },
    { src: '../prisma', dest: '../dist/prisma' },
    { src: '../.env', dest: '../dist/.env' }
];

filesToCopy.forEach(file => {
    const sourcePath = path.join(__dirname, file.src);
    const destPath = path.join(__dirname, file.dest);
    
    if (fs.existsSync(sourcePath)) {
        if (fs.lstatSync(sourcePath).isDirectory()) {
            fs.cpSync(sourcePath, destPath, { recursive: true });
        } else {
            fs.copyFileSync(sourcePath, destPath);
        }
    }
});

// Create index.js if it doesn't exist
const indexPath = path.join(distDir, 'index.js');
if (!fs.existsSync(indexPath)) {
    fs.writeFileSync(indexPath, `require('./src/index.js');`);
}

console.log('Build fix completed successfully!');
