const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

// Root uploads folder
const uploadBaseDir = path.resolve(__dirname, '../../uploads');
const imagesDir = path.join(uploadBaseDir, 'images');
const docsDir = path.join(uploadBaseDir, 'documents');

// Ensure directories exist
if (!fs.existsSync(uploadBaseDir)) fs.mkdirSync(uploadBaseDir, { recursive: true });
if (!fs.existsSync(imagesDir)) fs.mkdirSync(imagesDir, { recursive: true });
if (!fs.existsSync(docsDir)) fs.mkdirSync(docsDir, { recursive: true });

// Configuration for file storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    // Separate images and document files into distinct folders
    const isImage = file.mimetype.startsWith('image/');
    cb(null, isImage ? imagesDir : docsDir);
  },
  filename: (req, file, cb) => {
    const fileExt = path.extname(file.originalname).toLowerCase();
    const randomName = crypto.randomBytes(16).toString('hex');
    cb(null, `${randomName}-${Date.now()}${fileExt}`);
  }
});

// File validation filter
const fileFilter = (req, file, cb) => {
  const allowedExtensions = ['.jpg', '.jpeg', '.png', '.webp', '.pdf', '.docx', '.xlsx'];
  const allowedMimeTypes = [
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/webp',
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // docx
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // xlsx
    'application/vnd.ms-excel' // xls
  ];

  const ext = path.extname(file.originalname).toLowerCase();
  
  if (!allowedExtensions.includes(ext) || !allowedMimeTypes.includes(file.mimetype)) {
    return cb(new Error(`File type not allowed. Supported types: JPG, JPEG, PNG, WEBP, PDF, DOCX, XLSX.`), false);
  }
  
  cb(null, true);
};

// Create multer upload instances
const uploadImage = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 } // 5MB limit
});

const uploadDocument = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});

module.exports = {
  uploadImage,
  uploadDocument,
  uploadBaseDir,
  imagesDir,
  docsDir
};
