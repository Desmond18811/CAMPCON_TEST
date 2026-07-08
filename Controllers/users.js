import User from "../Models/User.js";
import jwt from 'jsonwebtoken';
import passport from "passport";

const signToken = (id) => {
    return jwt.sign({ id }, process.env.JWT_SECRET, {
        expiresIn: '30d'
    });
};

export const register = async (req, res) => {
    try {
        const { username, email, password, school } = req.body;

        const existingUser = await User.findOne({
            $or: [{ email }, { username }]
        });

        if (existingUser) {
            let message = '🔴 User already exists with this email or username';
            if (existingUser.email === email && existingUser.googleId && !existingUser.password) {
                message = '🔴 An account with this email was created with Google. Please log in with Google instead.';
            } else if (existingUser.email === email) {
                message = '🔴 An account with this email already exists. Please log in instead.';
            } else if (existingUser.username === username) {
                message = '🔴 This username is already taken. Please choose another one.';
            }
            return res.status(409).json({
                success: false,
                message
            });
        }

        const newUser = await User.create({
            username,
            email,
            password,
            school,
            profileCompleted: true // regular signup collects username and school upfront
        });

        const token = signToken(newUser._id);

        newUser.password = undefined;

        res.status(201).json({
            success: true,
            message: '🟢 User created successfully',
            data: newUser,
            token
        });
    } catch (error) {
        // Duplicate key race (unique index on email/username)
        if (error.code === 11000) {
            const field = Object.keys(error.keyPattern || {})[0] || 'account';
            return res.status(409).json({
                success: false,
                message: `🔴 This ${field} is already in use.`
            });
        }
        if (error.name === 'ValidationError') {
            const firstError = Object.values(error.errors)[0]?.message || 'Invalid registration data';
            return res.status(400).json({
                success: false,
                message: `🔴 ${firstError}`
            });
        }
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

export const login = async (req, res, next) => {
    passport.authenticate('local', { session: false }, (err, user, info) => {
        if (err) return next(err);
        if (!user) {
            return res.status(401).json({
                success: false,
                message: info ? info.message : '🔴 Authentication failed'
            });
        }

        const token = signToken(user._id);

        user.password = undefined;

        return res.json({
            success: true,
            message: '🟢 Logged in successfully',
            data: user,
            token
        });
    })(req, res, next);
};

export const logout = async (req, res) => {
    res.json({
        success: true,
        message: ' 🟢 Logged out successfully (remove token client-side)'
    });
};

export const getCurrentUser = async (req, res) => {
    const user = { ...req.user._doc };
    user.password = undefined;
    res.json({
        success: true,
        data: user
    });
};

// Get current user profile
export const getProfile = async (req, res) => {
    try {
        const user = await User.findById(req.user._id).select('-password -googleId');
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }
        res.json({
            success: true,
            data: user
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

// Create user profile
export const createProfile = async (req, res) => {
    try {
        const { username, schoolName, level, bio } = req.body;

        // Check if the user already has a profile
        const existingUser = await User.findById(req.user._id);
        if (existingUser && (existingUser.username || existingUser.school || existingUser.gradeLevel || existingUser.bio)) {
            return res.status(400).json({
                success: false,
                message: '🔴 Profile already exists for this user'
            });
        }

        // Prepare updates with mapped fields
        const updates = {
            username: username || existingUser?.username, // Retain existing username if not provided
            school: schoolName,
            gradeLevel: level,
            bio: bio || '',
            profileCompleted: true,
        };

        // Handle profile picture upload if provided
        if (req.file) {
            updates.profilePic = req.file.path;
        }

        // Create or update the profile
        const updatedUser = await User.findByIdAndUpdate(
            req.user._id,
            updates,
            { new: true, runValidators: true, upsert: true }
        ).select('-password -googleId');

        res.json({
            success: true,
            message: '🟢 Profile created successfully',
            data: updatedUser
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

// Update user profile (supports partial updates and profile pic upload)
export const updateProfile = async (req, res) => {
    try {
        const updates = req.body;

        // Handle profile picture upload if provided
        if (req.file) {
            updates.profilePic = req.file.path;
        }

        // Ensure gradeLevel (mapped from level in frontend) is handled
        if (updates.level) {
            updates.gradeLevel = updates.level;
            delete updates.level;
        }

        updates.profileCompleted = true;

        // Update only provided fields
        const updatedUser = await User.findByIdAndUpdate(
            req.user._id,
            updates,
            { new: true, runValidators: true }
        ).select('-password -googleId');

        if (!updatedUser) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        res.json({
            success: true,
            message: 'Profile updated successfully',
            data: updatedUser
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

// Save the user's last checkpoint (route/section) so sessions can resume where they stopped
export const updateCheckpoint = async (req, res) => {
    try {
        const { checkpoint } = req.body;

        if (typeof checkpoint !== 'string' || checkpoint.length > 200 || !checkpoint.startsWith('/')) {
            return res.status(400).json({
                success: false,
                message: 'Checkpoint must be an app path like "/home" (max 200 chars)'
            });
        }

        await User.findByIdAndUpdate(req.user._id, { lastCheckpoint: checkpoint });

        res.json({
            success: true,
            data: { lastCheckpoint: checkpoint }
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

// Forgot Password - Generate reset token and send email
export const forgotPassword = async (req, res) => {
    try {
        const { email } = req.body;

        if (!email) {
            return res.status(400).json({
                success: false,
                message: 'Please provide your email address'
            });
        }

        const user = await User.findOne({ email });

        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'No user found with that email address'
            });
        }

        // Generate a random reset token
        const crypto = await import('crypto');
        const resetToken = crypto.randomBytes(32).toString('hex');

        // Hash the token before storing
        const hashedToken = crypto.createHash('sha256').update(resetToken).digest('hex');

        // Set token and expiration (1 hour)
        user.passwordResetToken = hashedToken;
        user.passwordResetExpires = Date.now() + 60 * 60 * 1000; // 1 hour
        await user.save({ validateBeforeSave: false });

        // Create reset URL
        const resetUrl = `${process.env.CLIENT_URL}/reset-password/${resetToken}`;

        // For now, log the token (in production, send via email service like Nodemailer/SendGrid)
        console.log(`Password reset token for ${email}: ${resetToken}`);
        console.log(`Reset URL: ${resetUrl}`);

        // TODO: Integrate email service here
        // Example with Nodemailer (requires setup):
        // await sendEmail({ email, subject: 'Password Reset', message: `Reset your password: ${resetUrl}` });

        res.json({
            success: true,
            message: 'Password reset link sent to your email. Check your inbox.',
            // In development, you might want to return the token for testing
            ...(process.env.NODE_ENV === 'development' && { resetToken, resetUrl })
        });
    } catch (error) {
        console.error('Forgot password error:', error);
        res.status(500).json({
            success: false,
            message: 'Error sending password reset email. Please try again later.'
        });
    }
};

// Reset Password - Verify token and update password
export const resetPassword = async (req, res) => {
    try {
        const { token } = req.params;
        const { password, confirmPassword } = req.body;

        if (!password || !confirmPassword) {
            return res.status(400).json({
                success: false,
                message: 'Please provide password and confirm password'
            });
        }

        if (password !== confirmPassword) {
            return res.status(400).json({
                success: false,
                message: 'Passwords do not match'
            });
        }

        if (password.length < 6) {
            return res.status(400).json({
                success: false,
                message: 'Password must be at least 6 characters'
            });
        }

        // Hash the token from URL to compare with stored hash
        const crypto = await import('crypto');
        const hashedToken = crypto.createHash('sha256').update(token).digest('hex');

        // Find user with valid token
        const user = await User.findOne({
            passwordResetToken: hashedToken,
            passwordResetExpires: { $gt: Date.now() }
        });

        if (!user) {
            return res.status(400).json({
                success: false,
                message: 'Password reset token is invalid or has expired'
            });
        }

        // Update password and clear reset fields
        user.password = password;
        user.passwordResetToken = null;
        user.passwordResetExpires = null;
        await user.save();

        // Generate new JWT token
        const newToken = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '30d' });

        res.json({
            success: true,
            message: 'Password reset successfully. You can now login with your new password.',
            token: newToken
        });
    } catch (error) {
        console.error('Reset password error:', error);
        res.status(500).json({
            success: false,
            message: 'Error resetting password. Please try again.'
        });
    }
};