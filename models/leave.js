const { required } = require('joi');
const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const leaveSchema = new Schema({
    card: {
        type: String,
        default: null,
        required: true
    },
    name: {
        type: String,
        default: null,
        required: true
    },
    leaveStartDate: {
        type: Date,
        default: null,
        required: true
    },
    leaveEndDate: {
        type: Date,
        default: null,
        required: true
    },
    totalLeaves: {
        type: Number,
        default: null,
        required: true
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});


module.exports = mongoose.model('Leave', leaveSchema);



