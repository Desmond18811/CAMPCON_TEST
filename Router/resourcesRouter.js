import express from 'express';
import { isAuthenticated } from '../Middleware/auth.js';
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
import upload from '../Middleware/multerConfig.js';

const router = express.Router();

router.get('/', getAllResources);
router.get('/:id', getResource);
router.post('/', isAuthenticated, upload.fields([
    { name: 'file', maxCount: 1 },
    { name: 'image', maxCount: 1 },
    { name: 'profilePic', maxCount: 1 }
]), createResource);
router.put('/:id', isAuthenticated, updateResource);
router.delete('/:id', isAuthenticated, deleteResource);
router.post('/:id/rate', isAuthenticated, rateResource);
router.post('/:id/like', isAuthenticated, likeResource);
router.post('/:id/save', isAuthenticated, saveResource);
router.get('/liked', isAuthenticated, getLikedResources);
router.get('/saved', isAuthenticated, getSavedResources);
router.get('/:id/views', isAuthenticated, getResourceViews);
router.get('/recommended', isAuthenticated, getRecommendedResources);
router.get('/:id/ratings', getResourceRatings);

export default router;