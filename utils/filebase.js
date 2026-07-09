import { S3Client, HeadObjectCommand, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { Upload } from '@aws-sdk/lib-storage';
import dotenv from 'dotenv';

dotenv.config();

export const FILEBASE_BUCKET = process.env.FILEBASE_BUCKET || 'campusconnect222';
const FILEBASE_ENDPOINT = process.env.FILEBASE_ENDPOINT || 'https://s3.filebase.io';
const FILEBASE_REGION = process.env.FILEBASE_REGION || 'us-east-1';
const IPFS_GATEWAY = process.env.FILEBASE_GATEWAY || 'https://ipfs.filebase.io/ipfs';
const SERVER_URL = process.env.SERVER_URL || 'https://campcon-test.onrender.com';

const filebase = new S3Client({
    endpoint: FILEBASE_ENDPOINT,
    region: FILEBASE_REGION,
    credentials: {
        accessKeyId: process.env.FILEBASE_KEY,
        secretAccessKey: process.env.FILEBASE_SECRET
    },
    forcePathStyle: true // Filebase requires path-style addressing
});

// Streams a file to Filebase and returns { key, cid, url }.
// IPFS buckets expose a CID after upload → public gateway URL.
// Non-IPFS/private buckets (like campusconnect222 today) get a URL served by
// our own /api/files proxy route, which streams the object with credentials.
export const uploadToFilebase = async ({ body, key, contentType }) => {
    const upload = new Upload({
        client: filebase,
        params: {
            Bucket: FILEBASE_BUCKET,
            Key: key,
            Body: body,
            ContentType: contentType || 'application/octet-stream'
        }
    });

    await upload.done();

    const head = await filebase.send(new HeadObjectCommand({
        Bucket: FILEBASE_BUCKET,
        Key: key
    }));

    const cid = head.Metadata?.cid || null;
    const url = cid
        ? `${IPFS_GATEWAY}/${cid}`
        : `${SERVER_URL}/api/files/${key.split('/').map(encodeURIComponent).join('/')}`;

    return { key, cid, size: head.ContentLength, url };
};

// Fetches an object (optionally a byte range) for the /api/files proxy route
export const getFilebaseObject = async (key, range) => {
    return filebase.send(new GetObjectCommand({
        Bucket: FILEBASE_BUCKET,
        Key: key,
        ...(range ? { Range: range } : {})
    }));
};

export const deleteFromFilebase = async (key) => {
    await filebase.send(new DeleteObjectCommand({
        Bucket: FILEBASE_BUCKET,
        Key: key
    }));
};

export default filebase;
