const mongoose = require('mongoose');
const Schema = mongoose.Schema;
const passportLocalMongoose = require('passport-local-mongoose');

const UserSchema = new Schema({
    email: {
        type: String,
        required: true,
        unique: true
    },
    card: {
        type: Number,
        default: null
    },
    name: {
        type: String,
        required: true,
    },
    serviceStatus: {
        type: String,
        enum: ['Serving', 'Retired', 'Other'],
        default: 'Other'
    },
    serviceNumber: {
        type: String,
        default: null
    },
    rank: {
        type: String,
        enum: [
            'Air Chief Marshal', 'Air Marshal',
            'Air Vice Marshal', 'Air Commodore', 'Group Captain',
            'Wing Commander', 'Squadron Leader', 'Flight Lieutenant',
            'Flying Officer', 'Master Warrant Officer', 'Warrant Officer',
            'Sergeant', 'Corporal', 'Leading Aircraftman',
            'Aircraftman', 'Other'
        ],
        default: 'Other'
    },
    withFamily: {
        type: String,
        enum: ['With', 'Without'],
        default: 'Without'
    },
    numberOfGuests: {
        type: Number,
        min: 1,
        default: null
    },
    purpose: {
        type: String,
        default: null
    },
    mobileNumber: {
        type: String,
        default: null
    },
    ipNumber: {
        type: String,
        default: null
    },
    permanentCategory: { type: Schema.Types.ObjectId, ref: 'Category' }
});

UserSchema.plugin(passportLocalMongoose);  //adding password and username field to schema

var User = mongoose.model('User', UserSchema);
module.exports = User;
