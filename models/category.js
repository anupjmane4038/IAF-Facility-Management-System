// models/Category.js
const mongoose = require('mongoose');

const itemSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        lowercase: true, // Automatically convert to lowercase
        trim: true // Remove surrounding whitespace
    },
    quantity: {
        type: Number,
        required: true
    }
});


const categorySchema = new mongoose.Schema({
    name: {
        type: String,
        required: true
    },
    items: [{
        name: String,
        quantity: Number
    }],
    custodian: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    temporaryCustodian: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        default: null
    }
});

module.exports = mongoose.model('Category', categorySchema);
