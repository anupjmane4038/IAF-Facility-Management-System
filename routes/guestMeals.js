// routes/guestMeals.js

const express = require('express');
const router = express.Router();
const GuestMeal = require('../models/guestMeal');
const { isLoggedIn, isAdmin, isGuest } = require('../middleware');

function formatDate(date) {
    if (!(date instanceof Date)) {
        throw new Error('The provided value is not a Date object');
    }

    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0'); // Months are zero-based
    const year = date.getFullYear();

    return `${day}-${month}-${year}`;
}

// Render the form
router.get('/guest-meals', isLoggedIn, isGuest, (req, res) => {
    res.render('guests/guestMeals', { currentUser: req.user });
});

// Handle form submission
router.post('/guest-meals', isLoggedIn, isGuest, async (req, res) => {
    const { mealFullName, mealStartDate, mealEndDate, mealNumberOfGuests } = req.body;

    if (mealNumberOfGuests < 1) {
        req.flash('error', 'Number of guests must be at least 1');
        return res.redirect('/guest-meals');
    }

    try {
        const guestMeal = new GuestMeal({
            mealFullName,
            mealStartDate,
            mealEndDate,
            mealNumberOfGuests
        });

        await guestMeal.save();
        req.flash('success', 'Guest meal registered successfully!');
        res.redirect('/guest-meals'); // Redirect to a success page or other appropriate location
    } catch (error) {
        console.error(error);
        req.flash('error', 'Something went wrong. Please try again.');
        res.redirect('/guest-meals');
    }
});

// My Meals page
router.get('/my-meals', isLoggedIn, isGuest, async (req, res) => {
    try {
        const today = new Date();
        const myMeals = await GuestMeal.find({
            mealFullName: req.user.name,
            mealEndDate: { $gte: today }
        });

        res.render('guests/myMeals', { myMeals });
    } catch (error) {
        console.error(error);
        req.flash('error', 'Something went wrong. Please try again.');
        res.redirect('/guest-meals');
    }
});


// routes/guestMeals.js

router.post('/cancelMeal/:id', isLoggedIn, isGuest, async (req, res) => {
    try {
        const mealId = req.params.id;

        // Find the meal by ID and remove it
        const result = await GuestMeal.findByIdAndDelete(mealId);

        if (!result) {
            req.flash('error', 'Meal not found');
            return res.redirect('/my-meals');
        }

        req.flash('success', 'Meal successfully cancelled');
        res.redirect('/my-meals');
    } catch (error) {
        console.error('Error cancelling meal:', error); // Log the error for debugging
        req.flash('error', 'An error occurred while cancelling the meal');
        res.redirect('/my-meals');
    }
});


// Render the guest meal list for admin
// Render the guest meal list for admin
// In your route file
router.get('/meal-list', isLoggedIn, isAdmin, async (req, res) => {
    try {
        const today = new Date();
        const meals = await GuestMeal.find({
            mealEndDate: { $gte: today }
        });

        res.render('admins/mealList', {
            meals,
            formatDate
        });
    } catch (error) {
        console.error('Error fetching meals for admin:', error);
        req.flash('error', 'An error occurred while fetching meals');
        res.redirect('/');
    }
});




module.exports = router;
