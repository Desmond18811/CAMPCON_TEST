import User from "../Models/User.js";
import passport from "passport";

export const register = async(req, res) => {
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

        // Remove password from output
        newUser.password = undefined;

        res.status(201).json({
            success: true,
            message: 'User created successfully',
            data: newUser
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
}

export const login = async(req, res, next) => {
    passport.authenticate('local', (err, user, info) => {
        if (err) return next(err);
        if (!user) {
            return res.status(401).json({
                success: false,
                message: info.message
            });
        }

        req.logIn(user, (err) => {
            if (err) return next(err);

            // Remove password from output
            user.password = undefined;

            return res.json({
                success: true,
                message: 'Logged in successfully',
                data: user
            });
        });
    })(req, res, next);
}

export const logout = async(req, res) => {
    req.logout((err) => {
        if (err) {
            return res.status(500).json({
                success: false,
                message: 'Error logging out'
            });
        }

        res.json({
            success: true,
            message: 'Logged out successfully'
        });
    });
}

export const getCurrentUser = async(req, res) => {
    if (req.user) {
        const user = { ...req.user._doc };
        user.password = undefined;
        res.json({
            success: true,
            data: user
        });
    } else {
        res.status(401).json({
            success: false,
            message: 'Not authenticated'
        });
    }
}