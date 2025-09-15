import express from 'express';
import {
    getAllResources, getResource, getResourceRatings, createResource, updateResource, deleteResource, rateResource,
    getResourceViews, getRecommendedResources, getSavedResources, getLikedResources, saveResource, likeResource
} from '../Controllers/resources.js'
import {isAuthenticated} from '../Middleware/Auth.js'


const router = express.Router();

// Public routes
router.get('/', getAllResources);
router.get('/:id', getResource); //or search for resource by id
router.get('/:id/ratings', getResourceRatings);

// Protected routes
router.post('/', isAuthenticated, createResource);
router.put('/:id', isAuthenticated, updateResource);
router.delete('/:id', isAuthenticated, deleteResource);
router.post('/:id/rate', isAuthenticated, rateResource);

router.post('/:id/like', isAuthenticated, likeResource);
router.post('/:id/save', isAuthenticated, saveResource);
router.get('/liked', isAuthenticated, getLikedResources);
router.get('/saved', isAuthenticated, getSavedResources);
router.get('/recommended', isAuthenticated, getRecommendedResources);
router.get('/:id/views', isAuthenticated, getResourceViews);  //for campus creators

export default router;