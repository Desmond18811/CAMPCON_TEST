import express from 'express';
import path from 'path';
import { getFilebaseObject } from '../utils/filebase.js';

const router = express.Router();

// Streams files stored in the (private) Filebase bucket to the browser.
// URLs look like /api/files/campus-connect/<timestamp>-<hash>-<name>.<ext>
// Supports Range requests so videos and audio can seek while playing.
// Supports ?download=true to force Content-Disposition attachment download.
router.get(/^\/(.+)/, async (req, res) => {
    const key = decodeURIComponent(req.params[0]);
    const range = req.headers.range;
    const isDownload = req.query.download === 'true';

    try {
        const object = await getFilebaseObject(key, range);

        res.status(range ? 206 : 200);
        
        const headers = {
            'Content-Type': object.ContentType || 'application/octet-stream',
            'Accept-Ranges': 'bytes',
            'Cache-Control': 'public, max-age=31536000, immutable',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Headers': 'Origin, X-Requested-With, Content-Type, Accept, Range'
        };

        if (isDownload) {
            const filename = path.basename(key);
            headers['Content-Disposition'] = `attachment; filename="${encodeURIComponent(filename)}"`;
        }

        res.set(headers);

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
