import Resource from "../Models/Resource.js";
import Rating from "../Models/Rating.js";
import Like from "../Models/Like.js";
import User from "../Models/User.js";
import Save from "../Models/Save.js";
import View from "../Models/View.js";
import Notification from "../Models/Notification.js";
import path from 'path';

// Get all resources with optional filtering
export const getAllResources = async (req, res) => {
    try {
        const { subject, gradeLevel, resourceType, searchQuery, page = 1, limit = 10 } = req.query;

        const filter = {};
        if (subject) filter.subject = subject;
        if (gradeLevel) filter.gradeLevel = gradeLevel;
        if (resourceType) filter.resourceType = resourceType;
        if (searchQuery) {
            filter.$text = { $search: searchQuery };
        }

        const sort = searchQuery ? { score: { $meta: "textScore" } } : { createdAt: -1 };

        const resources = await Resource.find(filter)
            .populate('uploader', 'username profilePic profileColor')
            .populate('taggedUsers', 'username profilePic profileColor')
            .sort(sort)
            .limit(limit * 1)
            .skip((page - 1) * limit);

        const total = await Resource.countDocuments(filter);

        // Add fileType to each resource
        const resourcesWithFileType = resources.map(resource => ({
            ...resource._doc,
            fileType: resource.fileUrl ? path.extname(resource.fileUrl).toLowerCase() : ''
        }));

        res.json({
            success: true,
            data: resourcesWithFileType,
            pagination: {
                currentPage: page,
                totalPages: Math.ceil(total / limit),
                totalResources: total
            }
        });
    } catch (error) {
        console.error('Error in getAllResources:', { message: error.message, stack: error.stack });
        res.status(500).json({
            success: false,
            message: `Failed to fetch resources: ${error.message}`
        });
    }
};

// Get a single resource
export const getResource = async (req, res) => {
    try {
        const resource = await Resource.findById(req.params.id)
            .populate('uploader', 'username profilePic profileColor')
            .populate('taggedUsers', 'username profilePic profileColor');

        if (!resource) {
            return res.status(404).json({
                success: false,
                message: 'Resource not found'
            });
        }
        if (req.user && resource.uploader._id.toString() !== req.user._id.toString()) {
            const existingView = await View.findOne({ user: req.user._id, resource: req.params.id });
            if (!existingView) {
                await View.create({ user: req.user._id, resource: req.params.id });
                await Resource.findByIdAndUpdate(req.params.id, { $inc: { viewCount: 1 } });
                await Notification.create({
                    recipient: resource.uploader._id,
                    type: 'view',
                    from: req.user._id,
                    resource: req.params.id,
                    message: `${req.user.username} viewed your resource "${resource.title}"`
                });
            } else {
                existingView.lastViewedAt = Date.now();
                await existingView.save();
            }
        }

        // Add fileType to resource
        const resourceWithFileType = {
            ...resource._doc,
            fileType: resource.fileUrl ? path.extname(resource.fileUrl).toLowerCase() : ''
        };

        res.json({
            success: true,
            data: resourceWithFileType
        });
    } catch (error) {
        console.error('Error in getResource:', { message: error.message, stack: error.stack });
        res.status(500).json({
            success: false,
            message: `Failed to fetch resource: ${error.message}`
        });
    }
};

// Create a new resource
export const createResource = async (req, res) => {
    try {
        console.log('Starting createResource');
        // Validate req.user
        if (!req.user || !req.user._id) {
            console.log('Authentication failed: No user data');
            return res.status(401).json({
                success: false,
                message: 'Unauthorized: No user data found'
            });
        }

        const { title, description = '', subject, gradeLevel, resourceType, tags = [], username, profileColor } = req.body;
        console.log('Request body:', req.body);
        console.log('Files:', req.files);
        console.log('User:', { id: req.user._id, username: req.user.username });

        // Validate required fields
        if (!title || !subject || !gradeLevel || !resourceType) {
            console.log('Missing required fields:', { title, subject, gradeLevel, resourceType });
            return res.status(400).json({
                success: false,
                message: 'Missing required fields: title, subject, gradeLevel, or resourceType'
            });
        }

        let fileUrl = '';
        let imageUrl = '';
        let profilePic = '';
        let fileType = '';
        if (req.files) {
            if (req.files['file'] && req.files['file'][0]) {
                fileUrl = `/Uploads/${req.files['file'][0].filename}`;
                fileType = path.extname(req.files['file'][0].originalname).toLowerCase();
            }
            if (req.files['image'] && req.files['image'][0]) {
                imageUrl = `/Uploads/${req.files['image'][0].filename}`;
            }
            if (req.files['profilePic'] && req.files['profilePic'][0]) {
                profilePic = `/Uploads/${req.files['profilePic'][0].filename}`;
            }
        }

        if (!fileUrl) {
            console.log('No file uploaded');
            return res.status(400).json({
                success: false,
                message: 'File upload is required'
            });
        }

        // Parse @username tags from description
        console.log('Parsing tags from description:', description);
        const tagMatches = description.match(/@(\w+)/g) || [];
        const taggedUsernames = tagMatches.map(tag => tag.slice(1).toLowerCase());
        console.log('Tagged usernames:', taggedUsernames);
        const foundUsers = await User.find({ username: { $in: taggedUsernames } }).select('_id username');
        console.log('Found users:', foundUsers);
        const validTaggedUsers = foundUsers.map(user => user._id);

        // Validate username matches req.user
        if (username && username.toLowerCase() !== req.user.username.toLowerCase()) {
            console.log('Username mismatch:', { provided: username, user: req.user.username });
            return res.status(400).json({
                success: false,
                message: 'Provided username does not match authenticated user'
            });
        }

        console.log('Creating resource with data:', {
            title,
            description,
            fileUrl,
            imageUrl,
            fileType,
            tags,
            taggedUsers: validTaggedUsers,
            uploader: req.user._id,
            profilePic,
            profileColor: profileColor || '#cc002e',
            subject,
            gradeLevel,
            resourceType
        });
        const resource = await Resource.create({
            title,
            description,
            fileUrl,
            imageUrl,
            fileType,
            tags,
            taggedUsers: validTaggedUsers,
            uploader: req.user._id,
            profilePic,
            profileColor: profileColor || '#cc002e',
            subject,
            gradeLevel,
            resourceType
        });
        console.log('Resource created:', resource._id);

        // Notify tagged users
        for (const taggedUserId of validTaggedUsers) {
            if (taggedUserId.toString() !== req.user._id.toString()) {
                console.log('Creating notification for user:', taggedUserId);
                await Notification.create({
                    recipient: taggedUserId,
                    type: 'tag',
                    from: req.user._id,
                    resource: resource._id,
                    message: `${req.user.username} tagged you in their resource "${title}"`
                });
            }
        }

        console.log('Populating resource:', resource._id);
        const populatedResource = await Resource.findById(resource._id)
            .populate('uploader', 'username profilePic profileColor')
            .populate('taggedUsers', 'username profilePic profileColor');

        res.status(201).json({
            success: true,
            message: 'Resource created successfully',
            data: { ...populatedResource._doc, fileType }
        });
    } catch (error) {
        console.error('Error in createResource:', {
            message: error.message,
            stack: error.stack,
            body: req.body,
            files: req.files
        });
        res.status(500).json({
            success: false,
            message: `Failed to create resource: ${error.message}`
        });
    }
};

// Update resource
export const updateResource = async (req, res) => {
    try {
        const { description = '', title, subject, gradeLevel, resourceType, tags, profileColor, profilePic } = req.body;
        const resource = await Resource.findById(req.params.id);

        if (!resource) {
            return res.status(404).json({
                success: false,
                message: 'Resource not found'
            });
        }

        if (resource.uploader.toString() !== req.user._id.toString()) {
            return res.status(403).json({
                success: false,
                message: 'Not authorized to update this resource'
            });
        }

        // Parse @username tags from description
        const tagMatches = description.match(/@(\w+)/g) || [];
        const taggedUsernames = tagMatches.map(tag => tag.slice(1).toLowerCase());
        const foundUsers = await User.find({ username: { $in: taggedUsernames } }).select('_id');
        const validTaggedUsers = foundUsers.map(user => user._id);

        // Notify newly tagged users
        const existingTaggedUsers = resource.taggedUsers.map(id => id.toString());
        const newTaggedUsers = validTaggedUsers.filter(id => !existingTaggedUsers.includes(id.toString()));
        for (const taggedUserId of newTaggedUsers) {
            if (taggedUserId.toString() !== req.user._id.toString()) {
                await Notification.create({
                    recipient: taggedUserId,
                    type: 'tag',
                    from: req.user._id,
                    resource: req.params.id,
                    message: `${req.user.username} tagged you in their resource "${resource.title}"`
                });
            }
        }

        let updateData = { title, description, subject, gradeLevel, resourceType, tags, profileColor, profilePic, taggedUsers: validTaggedUsers };
        if (req.files) {
            if (req.files['file'] && req.files['file'][0]) {
                updateData.fileUrl = `/Uploads/${req.files['file'][0].filename}`;
                updateData.fileType = path.extname(req.files['file'][0].originalname).toLowerCase();
            }
            if (req.files['image'] && req.files['image'][0]) {
                updateData.imageUrl = `/Uploads/${req.files['image'][0].filename}`;
            }
            if (req.files['profilePic'] && req.files['profilePic'][0]) {
                updateData.profilePic = `/Uploads/${req.files['profilePic'][0].filename}`;
            }
        }

        const updatedResource = await Resource.findByIdAndUpdate(
            req.params.id,
            updateData,
            { new: true, runValidators: true }
        ).populate('uploader', 'username profilePic profileColor')
            .populate('taggedUsers', 'username profilePic profileColor');

        res.json({
            success: true,
            message: 'Resource updated successfully',
            data: updatedResource
        });
    } catch (error) {
        console.error('Error in updateResource:', { message: error.message, stack: error.stack });
        res.status(500).json({
            success: false,
            message: `Failed to update resource: ${error.message}`
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

        if (resource.uploader.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
            return res.status(403).json({
                success: false,
                message: 'Not authorized to delete this resource'
            });
        }

        await Resource.findByIdAndDelete(req.params.id);
        await Rating.deleteMany({ resource: req.params.id });
        await Like.deleteMany({ resource: req.params.id });
        await Save.deleteMany({ resource: req.params.id });
        await View.deleteMany({ resource: req.params.id });
        await Notification.deleteMany({ resource: req.params.id });

        res.json({
            success: true,
            message: 'Resource deleted successfully'
        });
    } catch (error) {
        console.error('Error in deleteResource:', { message: error.message, stack: error.stack });
        res.status(500).json({
            success: false,
            message: `Failed to delete resource: ${error.message}`
        });
    }
};

// Rate a resource
export const rateResource = async (req, res) => {
    try {
        const { rating, comment } = req.body;
        const resourceId = req.params.id;
        const userId = req.user._id;

        const resource = await Resource.findById(resourceId).populate('uploader', 'username');
        if (!resource) {
            return res.status(404).json({
                success: false,
                message: 'Resource not found'
            });
        }

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

        // Parse @username tags from comment
        const tagMatches = comment.match(/@(\w+)/g) || [];
        const taggedUsernames = tagMatches.map(tag => tag.slice(1).toLowerCase());
        const foundUsers = await User.find({ username: { $in: taggedUsernames } }).select('_id');
        const validTaggedUsers = foundUsers.map(user => user._id);

        const newRating = await Rating.create({
            user: userId,
            resource: resourceId,
            rating,
            comment,
            taggedUsers: validTaggedUsers
        });

        // Notify tagged users
        for (const taggedUserId of validTaggedUsers) {
            if (taggedUserId.toString() !== userId.toString()) {
                await Notification.create({
                    recipient: taggedUserId,
                    type: 'tag_comment',
                    from: userId,
                    resource: resourceId,
                    message: `${req.user.username} tagged you in a comment on "${resource.title}"`
                });
            }
        }

        // Notify resource owner
        if (resource.uploader._id.toString() !== userId.toString()) {
            await Notification.create({
                recipient: resource.uploader._id,
                type: 'rating',
                from: userId,
                resource: resourceId,
                message: `${req.user.username} rated your resource "${resource.title}" with ${rating} stars${comment ? ' and commented' : ''}`
            });
        }

        const ratings = await Rating.find({ resource: resourceId });
        const totalRating = ratings.reduce((sum, r) => sum + r.rating, 0);
        const averageRating = totalRating / ratings.length || 0;

        await Resource.findByIdAndUpdate(resourceId, {
            averageRating,
            ratingsCount: ratings.length
        });

        const populatedRating = await Rating.findById(newRating._id)
            .populate('user', 'username profilePic profileColor')
            .populate('taggedUsers', 'username profilePic profileColor');

        res.status(201).json({
            success: true,
            message: 'Resource rated successfully',
            data: populatedRating
        });
    } catch (error) {
        console.error('Error in rateResource:', { message: error.message, stack: error.stack });
        res.status(500).json({
            success: false,
            message: `Failed to rate resource: ${error.message}`
        });
    }
};

// Like a resource
export const likeResource = async (req, res) => {
    try {
        const resourceId = req.params.id;
        const userId = req.user._id;

        const resource = await Resource.findById(resourceId);
        if (!resource) {
            return res.status(404).json({ success: false, message: 'Resource not found' });
        }

        const existingLike = await Like.findOne({ user: userId, resource: resourceId });

        if (existingLike) {
            await Like.deleteOne({ _id: existingLike._id });
            await User.findByIdAndUpdate(userId, { $pull: { likedResources: resourceId } });
            await Resource.findByIdAndUpdate(resourceId, { $inc: { likeCount: -1 } });
            return res.json({ success: true, message: 'Resource unliked' });
        } else {
            await Like.create({ user: userId, resource: resourceId });
            await User.findByIdAndUpdate(userId, { $push: { likedResources: resourceId } });
            await Resource.findByIdAndUpdate(resourceId, { $inc: { likeCount: 1 } });
            if (resource.uploader.toString() !== userId.toString()) {
                await Notification.create({
                    recipient: resource.uploader,
                    type: 'like',
                    from: userId,
                    resource: resourceId,
                    message: `${req.user.username} liked your resource "${resource.title}"`
                });
            }
            return res.json({ success: true, message: 'Resource liked' });
        }
    } catch (error) {
        console.error('Error in likeResource:', { message: error.message, stack: error.stack });
        res.status(500).json({
            success: false,
            message: `Failed to like resource: ${error.message}`
        });
    }
};

// Save a resource
export const saveResource = async (req, res) => {
    try {
        const resourceId = req.params.id;
        const userId = req.user._id;

        const resource = await Resource.findById(resourceId);
        if (!resource) {
            return res.status(404).json({ success: false, message: 'Resource not found' });
        }

        const existingSave = await Save.findOne({ user: userId, resource: resourceId });

        if (existingSave) {
            await Save.deleteOne({ _id: existingSave._id });
            await User.findByIdAndUpdate(userId, { $pull: { savedResources: resourceId } });
            return res.json({ success: true, message: 'Resource unsaved' });
        } else {
            await Save.create({ user: userId, resource: resourceId });
            await User.findByIdAndUpdate(userId, { $push: { savedResources: resourceId } });
            return res.json({ success: true, message: 'Resource saved' });
        }
    } catch (error) {
        console.error('Error in saveResource:', { message: error.message, stack: error.stack });
        res.status(500).json({
            success: false,
            message: `Failed to save resource: ${error.message}`
        });
    }
};

// Get liked resources
export const getLikedResources = async (req, res) => {
    try {
        const userId = req.user._id;
        const { page = 1, limit = 10 } = req.query;

        const likes = await Like.find({ user: userId })
            .populate({
                path: 'resource',
                populate: { path: 'uploader', select: 'username profilePic profileColor' }
            })
            .sort({ createdAt: -1 })
            .limit(limit * 1)
            .skip((page - 1) * limit);

        const total = await Like.countDocuments({ user: userId });

        res.json({
            success: true,
            data: likes.map(l => l.resource).filter(r => r),
            pagination: {
                currentPage: page,
                totalPages: Math.ceil(total / limit),
                totalResources: total
            }
        });
    } catch (error) {
        console.error('Error in getLikedResources:', { message: error.message, stack: error.stack });
        res.status(500).json({
            success: false,
            message: `Failed to fetch liked resources: ${error.message}`
        });
    }
};

// Get saved resources
export const getSavedResources = async (req, res) => {
    try {
        const userId = req.user._id;
        const { page = 1, limit = 10 } = req.query;

        const saves = await Save.find({ user: userId })
            .populate({
                path: 'resource',
                populate: { path: 'uploader', select: 'username profilePic profileColor' }
            })
            .sort({ createdAt: -1 })
            .limit(limit * 1)
            .skip((page - 1) * limit);

        const total = await Save.countDocuments({ user: userId });

        res.json({
            success: true,
            data: saves.map(s => s.resource).filter(r => r),
            pagination: {
                currentPage: page,
                totalPages: Math.ceil(total / limit),
                totalResources: total
            }
        });
    } catch (error) {
        console.error('Error in getSavedResources:', { message: error.message, stack: error.stack });
        res.status(500).json({
            success: false,
            message: `Failed to fetch saved resources: ${error.message}`
        });
    }
};

// Get resource views
export const getResourceViews = async (req, res) => {
    try {
        const resource = await Resource.findById(req.params.id);
        if (!resource) {
            return res.status(404).json({ success: false, message: 'Resource not found' });
        }

        if (resource.uploader.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
            return res.status(403).json({ success: false, message: 'Not authorized' });
        }

        const views = await View.find({ resource: req.params.id })
            .populate('user', 'username profilePic profileColor')
            .sort({ lastViewedAt: -1 });

        res.json({
            success: true,
            data: views
        });
    } catch (error) {
        console.error('Error in getResourceViews:', { message: error.message, stack: error.stack });
        res.status(500).json({
            success: false,
            message: `Failed to fetch resource views: ${error.message}`
        });
    }
};

// Get recommended resources
export const getRecommendedResources = async (req, res) => {
    try {
        const userId = req.user._id;
        const { page = 1, limit = 10 } = req.query;

        const liked = await Like.find({ user: userId }).populate('resource');
        const subjects = [...new Set(liked.map(l => l.resource?.subject).filter(s => s))];
        const gradeLevels = [...new Set(liked.map(l => l.resource?.gradeLevel).filter(g => g))];
        const likedIds = liked.map(l => l.resource?._id).filter(id => id);

        if (subjects.length === 0 && gradeLevels.length === 0) {
            const popular = await Resource.find({ uploader: { $ne: userId } })
                .populate('uploader', 'username profilePic profileColor')
                .sort({ likeCount: -1, averageRating: -1, viewCount: -1 })
                .limit(limit * 1)
                .skip((page - 1) * limit);

            const total = await Resource.countDocuments({ uploader: { $ne: userId } });

            return res.json({
                success: true,
                data: popular,
                pagination: { currentPage: page, totalPages: Math.ceil(total / limit), totalResources: total }
            });
        }

        const filter = {
            $or: [{ subject: { $in: subjects } }, { gradeLevel: { $in: gradeLevels } }],
            uploader: { $ne: userId },
            _id: { $nin: likedIds }
        };

        const recommended = await Resource.find(filter)
            .populate('uploader', 'username profilePic profileColor')
            .sort({ likeCount: -1, averageRating: -1, viewCount: -1 })
            .limit(limit * 1)
            .skip((page - 1) * limit);

        const total = await Resource.countDocuments(filter);

        res.json({
            success: true,
            data: recommended,
            pagination: { currentPage: page, totalPages: Math.ceil(total / limit), totalResources: total }
        });
    } catch (error) {
        console.error('Error in getRecommendedResources:', { message: error.message, stack: error.stack });
        res.status(500).json({
            success: false,
            message: `Failed to fetch recommended resources: ${error.message}`
        });
    }
};

// Get ratings for a resource
export const getResourceRatings = async (req, res) => {
    try {
        const ratings = await Rating.find({ resource: req.params.id })
            .populate('user', 'username profilePic profileColor')
            .populate('taggedUsers', 'username profilePic profileColor')
            .sort({ createdAt: -1 });

        res.json({
            success: true,
            data: ratings
        });
    } catch (error) {
        console.error('Error in getResourceRatings:', { message: error.message, stack: error.stack });
        res.status(500).json({
            success: false,
            message: `Failed to fetch ratings: ${error.message}`
        });
    }
};