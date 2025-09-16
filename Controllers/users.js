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

        // Check if user exists
        const existingUser = await User.findOne({
            $or: [{ email }, { username }]
        });

        if (existingUser) {
            return res.status(400).json({
                success: false,
                message: '🔴 User already exists with this email or username'
            });
        }

        // Create new user
        const newUser = await User.create({
            username,
            email,
            password,
            school
        });

        // Generate JWT
        const token = signToken(newUser._id);

        // Remove password from output
        newUser.password = undefined;

        res.status(201).json({
            success: true,
            message: '🟢 User created successfully',
            data: newUser,
            token
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

export const login = async (req, res, next) => {
    // Use passport local with session: false
    passport.authenticate('local', { session: false }, (err, user, info) => {
        if (err) return next(err);
        if (!user) {
            return res.status(401).json({
                success: false,
                message: info ? info.message : '🔴 Authentication failed'
            });
        }

        // Generate JWT
        const token = signToken(user._id);

        // Remove password from output
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
    // With JWT, no server-side logout; client deletes token
    res.json({
        success: true,
        message: ' 🟢 Logged out successfully (remove token client-side)'
    });
};

export const getCurrentUser = async (req, res) => {
    // req.user is set by JWT middleware
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
        const user = await User.findById(req.user._id).select('-password -googleId'); // Exclude sensitive fields
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

// Update user profile (supports partial updates and profile pic upload)
export const updateProfile = async (req, res) => {
    try {
        const updates = req.body; // Fields like username, school, gradeLevel, bio

        // Handle profile picture upload if provided
        if (req.file) {
            updates.profilePic = `/uploads/${req.file.filename}`;
        }

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