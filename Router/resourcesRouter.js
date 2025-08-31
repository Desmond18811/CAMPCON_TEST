import express from 'express';
import {getAllResources, getResource, getResourceRatings, createResource, updateResource, deleteResource, rateResource} from '../Controllers/resources.js'
import {isAuthenticated} from '../Middleware/Auth.js'


const router = express.Router();

// Public routes
router.get('/', getAllResources);
router.get('/:id', getResource);
router.get('/:id/ratings', getResourceRatings);

// Protected routes
router.post('/', isAuthenticated, createResource);
router.put('/:id', isAuthenticated, updateResource);
router.delete('/:id', isAuthenticated, deleteResource);
router.post('/:id/rate', isAuthenticated, rateResource);

export default router;