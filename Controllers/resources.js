import Resource from "../Models/Resource.js";
import Rating from "../Models/Rating.js";

// Get all resources with optional filtering
export const getAllResources = async (req, res) => {
    try {
        const { subject, gradeLevel, resourceType, page = 1, limit = 10 } = req.query;

        // Build filter object
        const filter = {};
        if (subject) filter.subject = subject;
        if (gradeLevel) filter.gradeLevel = gradeLevel;
        if (resourceType) filter.resourceType = resourceType;

        const resources = await Resource.find(filter)
            .populate('uploader', 'username')
            .sort({ createdAt: -1 })
            .limit(limit * 1)
            .skip((page - 1) * limit);

        const total = await Resource.countDocuments(filter);

        res.json({
            success: true,
            data: resources,
            pagination: {
                currentPage: page,
                totalPages: Math.ceil(total / limit),
                totalResources: total
            }
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

// Get single resource
export const getResource = async (req, res) => {
    try {
        const resource = await Resource.findById(req.params.id)
            .populate('uploader', 'username email');

        if (!resource) {
            return res.status(404).json({
                success: false,
                message: 'Resource not found'
            });
        }

        res.json({
            success: true,
            data: resource
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

// Create new resource
export const createResource = async (req, res) => {
    try {
        const { title, description, fileUrl, subject, gradeLevel, resourceType } = req.body;

        const resource = await Resource.create({
            title,
            description,
            fileUrl,
            subject,
            gradeLevel,
            resourceType,
            uploader: req.user._id
        });

        const populatedResource = await Resource.findById(resource._id)
            .populate('uploader', 'username');

        res.status(201).json({
            success: true,
            message: 'Resource created successfully',
            data: populatedResource
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

// Update resource
export const updateResource = async (req, res) => {
    try {
        const resource = await Resource.findById(req.params.id);

        if (!resource) {
            return res.status(404).json({
                success: false,
                message: 'Resource not found'
            });
        }

        // Check if user is the uploader
        if (resource.uploader.toString() !== req.user._id.toString()) {
            return res.status(403).json({
                success: false,
                message: 'Not authorized to update this resource'
            });
        }

        const updatedResource = await Resource.findByIdAndUpdate(
            req.params.id,
            req.body,
            { new: true, runValidators: true }
        ).populate('uploader', 'username');

        res.json({
            success: true,
            message: 'Resource updated successfully',
            data: updatedResource
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

// Delete resource
export const deleteResource = async (req, res) => {
    try {
        const resource = await Resource.findById(req.params.id);

        if (!resource) {
            return res.status(404).json({
                success: false,
                message: 'Resource not found'
            });
        }

        // Check if user is the uploader or admin
        if (resource.uploader.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
            return res.status(403).json({
                success: false,
                message: 'Not authorized to delete this resource'
            });
        }

        await Resource.findByIdAndDelete(req.params.id);

        // Also delete all ratings for this resource
        await Rating.deleteMany({ resource: req.params.id });

        res.json({
            success: true,
            message: 'Resource deleted successfully'
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

// Rate a resource
export const rateResource = async (req, res) => {
    try {
        const { rating, comment } = req.body;
        const resourceId = req.params.id;
        const userId = req.user._id;

        // Check if resource exists
        const resource = await Resource.findById(resourceId);
        if (!resource) {
            return res.status(404).json({
                success: false,
                message: 'Resource not found'
            });
        }

        // Check if user has already rated this resource
        const existingRating = await Rating.findOne({
            user: userId,
            resource: resourceId
        });

        if (existingRating) {
            return res.status(400).json({
                success: false,
                message: 'You have already rated this resource'
            });
        }

        // Create new rating
        const newRating = await Rating.create({
            user: userId,
            resource: resourceId,
            rating,
            comment
        });

        // Update resource's average rating and ratings count
        const ratings = await Rating.find({ resource: resourceId });
        const totalRating = ratings.reduce((sum, r) => sum + r.rating, 0);
        const averageRating = totalRating / ratings.length;

        await Resource.findByIdAndUpdate(resourceId, {
            averageRating,
            ratingsCount: ratings.length
        });

        res.status(201).json({
            success: true,
            message: 'Resource rated successfully',
            data: newRating
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

// Get ratings for a resource
export const getResourceRatings = async (req, res) => {
    try {
        const ratings = await Rating.find({ resource: req.params.id })
            .populate('user', 'username')
            .sort({ createdAt: -1 });

        res.json({
            success: true,
            data: ratings
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};