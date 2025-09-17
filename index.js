import express from 'express';
import connectDb from './Database/db.js';
import dotenv from 'dotenv';
import subscriptionRouter from "./Router/subscriptionRouter.js";
import authRouter from "./Router/authRouter.js";
import resourcesRouter from "./Router/resourcesRouter.js";
import userRouter from "./Router/userRouter.js"; // New import
import cors from 'cors';
import passport from "./Database/passport.js";
import notificationRouter from "./Router/notificationRouter.js";
import path from 'path';

dotenv.config();

const app = express();
const PORT = process.env.PORT;

// Serve static files from uploads directory
app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));

// Add CORS middleware
app.use(cors({
    origin: ['http://localhost:5173', 'http://localhost:3000', 'http://localhost:5174', 'http://localhost:5175', 'http://localhost:5176', 'http://localhost:5177', 'http://localhost:5178'],
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
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
app.use('/api/users', userRouter); // New user routes
app.use('/api/notifications', notificationRouter);
// Root endpoint
app.get('/', (req, res) => {
    return res.json({
        status: 'success',
        statusCode: 200,
        message: 'Hello welcome to Campus Connect 🟢',
    });
});

// Connect to MongoDB and start a server
connectDb().then(() => {
    app.listen(PORT, () => {
        console.log(`🟢 Listening on port http://localhost:${PORT}`);
    });
}).catch(err => {
    console.error('Failed to connect to DB:', err);
});