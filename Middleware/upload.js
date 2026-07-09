import multer from 'multer';
import path from 'path';
import crypto from 'crypto';
import { uploadToFilebase } from '../utils/filebase.js';

const ALLOWED_FORMATS = new Set([
    // Images
    'jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'svg', 'ico', 'tiff',
    // Documents
    'pdf', 'doc', 'docx', 'txt', 'rtf', 'odt', 'xls', 'xlsx', 'csv',
    // Presentations
    'ppt', 'pptx', 'odp',
    // Videos
    'mp4', 'mov', 'avi', 'mkv', 'webm', 'flv', 'wmv',
    // Audio
    'mp3', 'wav', 'ogg', 'flac', 'aac', 'm4a',
    // Archives
    'zip', 'rar', '7z', 'tar', 'gz'
]);

// Custom multer storage engine that streams uploads straight to Filebase (S3/IPFS).
// It keeps the same contract the old Cloudinary storage had: controllers keep
// reading `file.path`, which is now a public IPFS gateway URL viewable in the browser.
class FilebaseStorage {
    _handleFile(req, file, cb) {
        const ext = path.extname(file.originalname).toLowerCase();
        const safeName = path.basename(file.originalname, ext)
            .replace(/[^a-zA-Z0-9_-]/g, '_')
            .slice(0, 60);
        const key = `campus-connect/${Date.now()}-${crypto.randomBytes(4).toString('hex')}-${safeName}${ext}`;

        uploadToFilebase({
            body: file.stream,
            key,
            contentType: file.mimetype
        })
            .then(({ url, cid, size }) => {
                cb(null, {
                    path: url,      // public gateway URL — what controllers store in the DB
                    filename: key,  // S3 object key (needed to delete the file later)
                    cid,
                    size
                });
            })
            .catch(cb);
    }

    _removeFile(req, file, cb) {
        // Called by multer if a later middleware/file in the same request fails
        import('../utils/filebase.js')
            .then(({ deleteFromFilebase }) => deleteFromFilebase(file.filename))
            .then(() => cb(null))
            .catch(cb);
    }
}

const fileFilter = (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase().replace('.', '');
    if (!ext || ALLOWED_FORMATS.has(ext)) {
        return cb(null, true);
    }
    cb(new Error(`File type ".${ext}" is not allowed`));
};

const upload = multer({
    storage: new FilebaseStorage(),
    fileFilter,
    limits: { fileSize: 100 * 1024 * 1024 } // 100MB limit for larger videos
});

export default upload;
