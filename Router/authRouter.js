import express from 'express';
import passport from 'passport';
import {register, login, logout, getCurrentUser} from '../Controllers/users.js'

const router = express.Router();

// Regular registration and login
router.post('/register', register);
router.post('/login', login);

// Google OAuth routes
router.get('/google',
    passport.authenticate('google', { scope: ['profile', 'email'] })
);

router.get('/google/callback',
    passport.authenticate('google', {
        failureRedirect: process.env.CLIENT_URL + '/login',
        session: true
    }),
    (req, res) => {
        // Successful authentication, redirect to client
        res.redirect(process.env.CLIENT_URL);
    }
);

// Logout
router.get('/logout', logout);

// Get current user
router.get('/me', getCurrentUser);

export default router;