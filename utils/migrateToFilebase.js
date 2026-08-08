import mongoose from 'mongoose';
import dotenv from 'dotenv';
import fetch from 'node-fetch';
import path from 'path';
import crypto from 'crypto';
import Resource from '../Models/Resource.js';
import User from '../Models/User.js';
import { uploadToFilebase } from './filebase.js';

dotenv.config();

const MONGO_URI = process.env.MONGO_URI || process.env.MONGODB_URI || 'mongodb://localhost:27017/campus-connect';

const migrateUrlToFilebase = async (url, folder = 'migrated') => {
    if (!url || typeof url !== 'string') return null;
    // Skip if already on Filebase gateway or backend file proxy
    if (url.includes('s3.filebase.io') || url.includes('ipfs.filebase.io') || url.includes('/api/files/')) {
        return url;
    }
    // Only migrate http/https links (like Cloudinary or AWS S3)
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
        return url;
    }

    try {
        console.log(`📥 Downloading legacy file: ${url}`);
        const response = await fetch(url);
        if (!response.ok) {
            console.error(`⚠️ Failed to download legacy file (${response.status}): ${url}`);
            return url;
        }

        const buffer = await response.buffer();
        const contentType = response.headers.get('content-type') || 'application/octet-stream';
        
        let ext = path.extname(new URL(url).pathname) || '';
        if (!ext && contentType.includes('image/jpeg')) ext = '.jpg';
        if (!ext && contentType.includes('image/png')) ext = '.png';
        if (!ext && contentType.includes('application/pdf')) ext = '.pdf';
        
        const safeName = path.basename(new URL(url).pathname, ext).replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 40) || 'file';
        const key = `campus-connect/${folder}/${Date.now()}-${crypto.randomBytes(4).toString('hex')}-${safeName}${ext}`;

        console.log(`📤 Uploading to Filebase: ${key}`);
        const result = await uploadToFilebase({
            body: buffer,
            key,
            contentType
        });

        console.log(`✅ Migrated successfully: ${result.url}`);
        return result.url;
    } catch (err) {
        console.error(`❌ Migration error for ${url}:`, err.message);
        return url;
    }
};

const runMigration = async () => {
    console.log('🚀 Connecting to MongoDB...');
    await mongoose.connect(MONGO_URI);
    console.log('🟢 Connected to MongoDB.');

    // 1. Migrate Resources
    const resources = await Resource.find({});
    console.log(`📦 Checking ${resources.length} resources for Cloudinary/external URLs...`);
    let migratedResourcesCount = 0;

    for (const resDoc of resources) {
        let updated = false;

        if (resDoc.fileUrl && (resDoc.fileUrl.includes('cloudinary') || resDoc.fileUrl.includes('s3.amazonaws.com'))) {
            const newFileUrl = await migrateUrlToFilebase(resDoc.fileUrl, 'resources/files');
            if (newFileUrl !== resDoc.fileUrl) {
                resDoc.fileUrl = newFileUrl;
                updated = true;
            }
        }

        if (resDoc.imageUrl && (resDoc.imageUrl.includes('cloudinary') || resDoc.imageUrl.includes('s3.amazonaws.com'))) {
            const newImageUrl = await migrateUrlToFilebase(resDoc.imageUrl, 'resources/images');
            if (newImageUrl !== resDoc.imageUrl) {
                resDoc.imageUrl = newImageUrl;
                updated = true;
            }
        }

        if (resDoc.profilePic && (resDoc.profilePic.includes('cloudinary') || resDoc.profilePic.includes('s3.amazonaws.com'))) {
            const newProfilePic = await migrateUrlToFilebase(resDoc.profilePic, 'profiles');
            if (newProfilePic !== resDoc.profilePic) {
                resDoc.profilePic = newProfilePic;
                updated = true;
            }
        }

        if (updated) {
            await resDoc.save();
            migratedResourcesCount++;
        }
    }

    console.log(`🎉 Migrated ${migratedResourcesCount} Resource documents.`);

    // 2. Migrate User Profile Pics
    const users = await User.find({});
    console.log(`👤 Checking ${users.length} users for Cloudinary/external profile pics...`);
    let migratedUsersCount = 0;

    for (const userDoc of users) {
        if (userDoc.profilePic && (userDoc.profilePic.includes('cloudinary') || userDoc.profilePic.includes('s3.amazonaws.com'))) {
            const newProfilePic = await migrateUrlToFilebase(userDoc.profilePic, 'profiles');
            if (newProfilePic !== userDoc.profilePic) {
                userDoc.profilePic = newProfilePic;
                await userDoc.save();
                migratedUsersCount++;
            }
        }
    }

    console.log(`🎉 Migrated ${migratedUsersCount} User documents.`);

    console.log('🏁 Migration finished cleanly.');
    process.exit(0);
};

runMigration().catch(err => {
    console.error('Fatal migration script error:', err);
    process.exit(1);
});
