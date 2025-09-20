import express from 'express';
import { isAuthenticated } from '../Middleware/Auth.js';
import uploadMiddleware from '../Middleware/multerConfig.js';
import {
    getAllResources,
    getResource,
    createResource,
    updateResource,
    deleteResource,
    rateResource,
    likeResource,
    saveResource,
    getLikedResources,
    getSavedResources,
    getResourceViews,
    getRecommendedResources,
    getResourceRatings
} from '../Controllers/resources.js';

const router = express.Router();

router.get('/', getAllResources);
router.get('/liked', isAuthenticated, getLikedResources);
router.get('/saved', isAuthenticated, getSavedResources);
router.get('/recommended', isAuthenticated, getRecommendedResources);
router.get('/:id', getResource);
router.post('/', isAuthenticated, uploadMiddleware, createResource);
router.put('/:id', isAuthenticated, uploadMiddleware, updateResource);
router.delete('/:id', isAuthenticated, deleteResource);
router.post('/:id/rate', isAuthenticated, rateResource);
router.post('/:id/like', isAuthenticated, likeResource);
router.post('/:id/save', isAuthenticated, saveResource);
router.get('/:id/views', isAuthenticated, getResourceViews);
router.get('/:id/ratings', getResourceRatings);

export default router;