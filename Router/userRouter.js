import express from 'express';
import { getProfile, updateProfile, createProfile } from '../Controllers/users.js';
import { isAuthenticated } from '../Middleware/Auth.js';
import multer from 'multer';
import passport from "passport";

// Multer setup for profile picture upload
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, 'uploads/'); // Ensure this directory exists
    },
    filename: function (req, file, cb) {
        cb(null, Date.now() + '-' + file.originalname);
    }
});
const upload = multer({ storage: storage });

const router = express.Router();

// Get profile
router.get('/profile', isAuthenticated, getProfile);

// Create a profile (new endpoint)
router.post('/profile', passport.authenticate('jwt', { session: false }),isAuthenticated, upload.single('profilePic'), createProfile);

// Update profile (with optional file upload)
router.put('/profile', isAuthenticated, upload.single('profilePic'), updateProfile);

export default router;