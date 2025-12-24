import express from 'express';
import { getNotifications, markNotificationRead, markAllRead } from '../Controllers/Notification.js';
import { isAuthenticated } from '../Middleware/auth.js';

const router = express.Router();

router.get('/', isAuthenticated, getNotifications);
router.put('/:id/read', isAuthenticated, markNotificationRead);
router.put('/read-all', isAuthenticated, markAllRead);

export default router;