import express from 'express';
import connectDb from './Database/db.js';

import dotenv from 'dotenv';
import subscriptionRouter from "./Router/subscriptionRouter.js";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Mount subscriber routes
app.use('/api/subscribe', subscriptionRouter)

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
});