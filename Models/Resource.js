import mongoose from 'mongoose';

const resourceSchema = new mongoose.Schema({
    title: {
        type: String,
        required: [true, 'Title is required'],
        trim: true
    },
    description: {
        type: String,
        default: ''
    },
    fileUrl: {
        type: String,
        required: [true, 'File URL is required']
    },
    imageUrl: {
        type: String,
        default: ''
    },
    tags: {
        type: [String],
        default: []
    },
    taggedUsers: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    }],
    uploader: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: [true, 'Uploader is required']
    },
    profilePic: {
        type: String,
        default: ''
    },
    profileColor: {
        type: String,
        default: '#cc002e'
    },
    subject: {
        type: String,
        required: [true, 'Subject is required']
    },
    gradeLevel: {
        type: String,
        required: [true, 'Grade level is required']
    },
    resourceType: {
        type: String,
        enum: ['notes', 'assignment', 'textbook', 'video', 'document', 'other'],
        required: [true, 'Resource type is required']
    },
    averageRating: {
        type: Number,
        default: 0
    },
    ratingsCount: {
        type: Number,
        default: 0
    },
    likeCount: {
        type: Number,
        default: 0
    },
    viewCount: {
        type: Number,
        default: 0
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

resourceSchema.index({ title: 'text', description: 'text' });

const Resource = mongoose.model('Resource', resourceSchema);

export default Resource;