import passport from 'passport';
import GoogleStrategy from 'passport-google-oauth20';
import LocalStrategy from 'passport-google-oauth20';
import User from '../Models/User.js'

// Local strategy for email/password login
passport.use(
    new LocalStrategy({ usernameField: 'email' }, async (email, password, done) => {
        try {
            // Find user by email
            const user = await User.findOne({ email }).select('+password');

            if (!user) {
                return done(null, false, { message: 'Incorrect email or password' });
            }

            // Check if password is correct
            const isPasswordCorrect = await user.correctPassword(password, user.password);

            if (!isPasswordCorrect) {
                return done(null, false, { message: 'Incorrect email or password' });
            }

            // If everything is correct, return user
            return done(null, user);
        } catch (error) {
            return done(error);
        }
    })
);

// Google OAuth strategy
passport.use(
    new GoogleStrategy(
        {
            clientID: process.env.GOOGLE_CLIENT_ID,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET,
            callbackURL: '/api/auth/google/callback'
        },
        async (accessToken, refreshToken, profile, done) => {
            try {
                // Check if user already exists with this googleId
                let user = await User.findOne({ googleId: profile.id });

                if (user) {
                    return done(null, user);
                }

                // Check if user exists with the same email but different auth method
                user = await User.findOne({ email: profile.emails[0].value });

                if (user) {
                    // Link Google account to existing user
                    user.googleId = profile.id;
                    await user.save();
                    return done(null, user);
                }

                // Create new user with Google auth
                user = await User.create({
                    googleId: profile.id,
                    username: profile.displayName.replace(/\s+/g, '').toLowerCase() + Math.random().toString(36).substring(7),
                    email: profile.emails[0].value,
                    school: 'Unknown' // You might want to change this or make it required in a different way
                });

                return done(null, user);
            } catch (error) {
                return done(error, null);
            }
        }
    )
);

// Serialize user for session
passport.serializeUser((user, done) => {
    done(null, user.id);
});

// Deserialize user from session
passport.deserializeUser(async (id, done) => {
    try {
        const user = await User.findById(id);
        done(null, user);
    } catch (error) {
        done(error, null);
    }
});

export default passport