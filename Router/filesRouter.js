import express from 'express';
import { getFilebaseObject } from '../utils/filebase.js';

const router = express.Router();

// Streams files stored in the (private) Filebase bucket to the browser.
// URLs look like /api/files/campus-connect/<timestamp>-<hash>-<name>.<ext>
// Supports Range requests so videos and audio can seek while playing.
router.get(/^\/(.+)/, async (req, res) => {
    const key = decodeURIComponent(req.params[0]);
    const range = req.headers.range;

    try {
        const object = await getFilebaseObject(key, range);

        res.status(range ? 206 : 200);
        res.set({
            'Content-Type': object.ContentType || 'application/octet-stream',
            'Accept-Ranges': 'bytes',
            // Uploaded files never change (keys are unique per upload) — cache hard
            'Cache-Control': 'public, max-age=31536000, immutable'
        });
        if (object.ContentLength !== undefined) res.set('Content-Length', String(object.ContentLength));
        if (object.ContentRange) res.set('Content-Range', object.ContentRange);

        object.Body.pipe(res);
        object.Body.on('error', () => res.destroy());
    } catch (error) {
        const status = error.$metadata?.httpStatusCode;
        if (status === 404 || error.name === 'NoSuchKey' || error.name === 'NotFound') {
            return res.status(404).json({ success: false, message: 'File not found' });
        }
        console.error('File proxy error:', error.name, error.message);
        res.status(500).json({ success: false, message: 'Error fetching file' });
    }
});

export default router;
