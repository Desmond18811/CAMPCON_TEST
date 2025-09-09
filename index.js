import express from 'express';
import connectDb from './Database/db.js';
import dotenv from 'dotenv';
import subscriptionRouter from "./Router/subscriptionRouter.js";
import authRouter from "./Router/authRouter.js";
import resourcesRouter from "./Router/resourcesRouter.js";
import cors from 'cors';
import passport from "./Database/passport.js"; // Adjust path to your Passport config file

dotenv.config();

const app = express();
const PORT = process.env.PORT;

// Add CORS middleware
app.use(cors({
    origin: ['http://localhost:5173', 'http://localhost:3000', 'http://localhost:5174', 'http://localhost:5175', '\'http://localhost:5176\'', 'http://localhost:5177', 'http://localhost:5178'],
    credentials: true
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Initialize Passport (no session middleware needed for JWT)
app.use(passport.initialize());

// Mount routes
app.use('/api/subscribe', subscriptionRouter);
app.use('/api/auth', authRouter);
app.use('/api/resources', resourcesRouter);

// Root endpoint
app.get('/', (req, res) => {
    return res.json({
        status: 'success',
        statusCode: 200,
        message: 'Hello welcome to Campus Connect 🟢',
    });
});

// Connect to MongoDB and start server
connectDb().then(() => {
    app.listen(PORT, () => {
        console.log(`🟢 Listening on port http://localhost:${PORT}`);
    });
}).catch(err => {
    console.error('Failed to connect to DB:', err);
});