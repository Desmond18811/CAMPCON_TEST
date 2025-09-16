import express from 'express';
import multer from 'multer';
import {isAuthenticated} from '../middleware/Auth.js';
import {getProfile, updateProfile} from "../Controllers/users.js";


const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'uploads/');
    },
    filename: (req, file, cb) => {
        cb(null, `${Date.now()}-${file.originalname}`);
    }
})
const upload = multer({storage: storage});

const router = express.Router();

router.get('/profile', isAuthenticated, getProfile);

router.put('/profile', isAuthenticated, updateProfile);

export default router;