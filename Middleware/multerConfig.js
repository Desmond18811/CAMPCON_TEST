import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';

// Get __dirname equivalent in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configure storage
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadPath = path.join(__dirname, '../Uploads');
        cb(null, uploadPath);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, `${file.fieldname}-${uniqueSuffix}${path.extname(file.originalname)}`);
    }
});

// File filter to allow specific file types
const fileFilter = (req, file, cb) => {
    // Allowed file extensions
    const allowedExtensions = /\.(jpeg|jpg|png|gif|webp|bmp|pdf|doc|docx|txt|rtf|odt|ppt|pptx|xls|xlsx|csv|mp4|mov|avi|mp3|wav|zip|rar)$/i;

    // Allowed MIME types
    const allowedMimeTypes = [
        'image/jpeg',
        'image/jpg',
        'image/png',
        'image/gif',
        'image/webp',
        'image/bmp',
        'application/pdf',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'text/plain',
        'application/rtf',
        'application/vnd.oasis.opendocument.text',
        'application/vnd.ms-powerpoint',
        'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        'application/vnd.ms-excel',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'text/csv',
        'video/mp4',
        'video/quicktime',
        'video/x-msvideo',
        'audio/mpeg',
        'audio/wav',
        'application/zip',
        'application/x-rar-compressed'
    ];

    const extname = allowedExtensions.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedMimeTypes.includes(file.mimetype.toLowerCase());

    if (extname && mimetype) {
        return cb(null, true);
    } else {
        cb(new Error('Only images (jpeg, jpg, png, gif, webp, bmp), documents (pdf, doc, docx, txt, rtf, odt), presentations (ppt, pptx), spreadsheets (xls, xlsx, csv), videos (mp4, mov, avi), audio (mp3, wav), and archives (zip, rar) are allowed'), false);
    }
};

// Configure multer
const upload = multer({
    storage: storage,
    limits: {
        fileSize: 20 * 1024 * 1024 // 20MB limit
    },
    fileFilter: fileFilter
}).fields([
    { name: 'file', maxCount: 1 },
    { name: 'image', maxCount: 1 },
    { name: 'profilePic', maxCount: 1 }
]);

// Multer middleware wrapper to handle errors
const uploadMiddleware = (req, res, next) => {
    upload(req, res, (err) => {
        if (err instanceof multer.MulterError) {
            return res.status(400).json({
                success: false,
                message: `Multer error: ${err.message}`
            });
        } else if (err) {
            return res.status(400).json({
                success: false,
                message: `File upload error: ${err.message}`
            });
        }
        next();
    });
};

export default uploadMiddleware;