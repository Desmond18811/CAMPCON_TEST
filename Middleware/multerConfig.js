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
    const allowedTypes = /jpeg|jpg|png|gif|webp|bmp|pdf|doc|docx|txt|rtf|odt|ppt|pptx|xls|xlsx|csv|mp4|mov|avi|mp3|wav|zip|rar/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);

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
        fileSize: 10 * 1024 * 1024 // 10MB limit
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