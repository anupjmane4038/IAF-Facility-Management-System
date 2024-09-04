const express = require('express');
const router = express.Router();
const passport = require('passport');
const catchAsync = require('../utils/catchAsync');
const User = require('../models/user');
const { isLoggedIn, isAdmin, isMember } = require('../middleware');
const flash = require('connect-flash');

// Function to get the next card number
const getNextCardNumber = async () => {
    const lastUser = await User.findOne().sort({ card: -1 });

    if (lastUser && lastUser.card === -1) {
        lastUser.card = 0;
    }

    return lastUser ? lastUser.card + 1 : -2; // Start from -3 if no users
};

// Route to render the registration page with card number
router.get('/register', catchAsync(async (req, res) => {
    const nextCardNumber = await getNextCardNumber();
    res.render('users/register', { cardNumber: nextCardNumber });
}));

// Route to handle member registration
router.post('/register', catchAsync(async (req, res, next) => {
    try {
        const { email, name, username, password, card, rank, ipNumber, serviceStatus, mobileNumber } = req.body;

        // Check if card is present and valid for members
        if (!card || card.trim() === '') {
            req.flash('error', 'Card number is required for members');
            return res.redirect('/register');
        }

        // Create a new user with the additional fields
        const user = new User({
            email,
            card: Number(card),
            name,
            username,
            rank,
            ipNumber,
            serviceStatus,
            mobileNumber
        });

        const registeredUser = await User.register(user, password);
        req.login(registeredUser, err => {
            if (err) return next(err);
            req.flash('success', 'Registered successfully!');
            res.redirect('/');
        });

    } catch (e) {
        req.flash('error', e.message);
        res.redirect('/register');
    }
}));



// Route to handle guest registration
router.post('/guestregister', catchAsync(async (req, res, next) => {
    try {
        const { email, name, username, password } = req.body;

        // Create a new user with card set to null for guests
        const user = new User({ email, card: null, name, username });
        const registeredUser = await User.register(user, password);
        req.login(registeredUser, err => {
            if (err) return next(err);
            req.flash('success', 'Registered successfully as a guest!');
            res.redirect('/');
        });

    } catch (e) {
        req.flash('error', e.message);
        res.redirect('/register');
    }
}));


router.get('/login', async (req, res) => {
    res.render('users/login');
});

// Route to handle member login
router.post('/login', passport.authenticate('local', { failureFlash: 'Invalid username, password or card number', failureRedirect: '/login' }), (req, res) => {
    req.flash('success', 'Welcome back! You are successfully logged in.');
    const redirectUrl = req.session.returnTo || '/';
    delete req.session.returnTo;
    res.redirect(redirectUrl);
});

// Route to handle guest login
// Route to handle guest login
router.post('/guestlogin', passport.authenticate('local', {
    failureFlash: 'Invalid username or password.',
    failureRedirect: '/login'
}), (req, res) => {
    req.flash('success', 'Welcome back! You are successfully logged in as a guest.');
    const redirectUrl = req.session.returnTo || '/';
    delete req.session.returnTo;
    res.redirect(redirectUrl);
});


router.get('/logout', isLoggedIn, (req, res) => {
    req.logout();
    req.flash('success', 'Goodbye!');
    res.redirect('/');
});

module.exports = router;
