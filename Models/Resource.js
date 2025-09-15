import mongoose from 'mongoose'

const resourceSchema = new mongoose.Schema({
    title: {
        type: String,
        required: true
    },
    description: {
        type: String,
        required: false
    },
    fileUrl: {
        type: String,
        required: true
    },
    imageUrl: {
        type: String,
        default: ''
    },
    tags: {
        type: [String],
        default: []
    },
    uploader: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    subject: {
        type: String,
        required: true
    },
    gradeLevel: {
        type: String,
        required: true
    },
    resourceType: {
        type: String,
        enum: ['notes', 'assignment', 'textbook', 'video', 'other', 'document'],
        required: true
    },
    averageRating: {
        type: Number,
        default: 0
    },
    ratingsCount: {
        type: Number,
        default: 0
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

resourceSchema.add({
    likeCount: {
        type: Number,
        default: 0
    },
    viewCount: {
        type: Number,
        default: 0
    }
})

resourceSchema.index({title: 'text', description: 'text'})

const Resource = mongoose.model('Resource', resourceSchema);

export default Resource;