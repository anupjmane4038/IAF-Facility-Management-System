// models/GuestMeal.js

const mongoose = require('mongoose');

const guestMealSchema = new mongoose.Schema({
    mealFullName: {
        type: String,
        required: true
    },
    mealStartDate: {
        type: Date,
        required: true
    },
    mealEndDate: {
        type: Date,
        required: true
    },
    mealNumberOfGuests: {
        type: Number,
        required: true
    }
});

module.exports = mongoose.model('GuestMeal', guestMealSchema);
