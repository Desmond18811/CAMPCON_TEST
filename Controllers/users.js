import User from "../Models/User.js";
import jwt from 'jsonwebtoken'; // Added for JWT

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
                message: 'User already exists with this email or username'
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
            message: 'User created successfully',
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
                message: info ? info.message : 'Authentication failed'
            });
        }

        // Generate JWT
        const token = signToken(user._id);

        // Remove password from output
        user.password = undefined;

        return res.json({
            success: true,
            message: 'Logged in successfully',
            data: user,
            token
        });
    })(req, res, next);
};

export const logout = async (req, res) => {
    // With JWT, no server-side logout; client deletes token
    res.json({
        success: true,
        message: 'Logged out successfully (remove token client-side)'
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