const express = require('express');
const router = express.Router();
const NewMember = require('../models/user');
const { isLoggedIn, isAdmin } = require('../middleware');
const flash = require('connect-flash');

// Route to render guest list
router.get('/guests', isLoggedIn, isAdmin, async (req, res) => {
    try {
        const guestList = await NewMember.find({ card: null });
        res.render('admins/guests', { guestList });
    } catch (err) {
        console.error('Error fetching guest list:', err);
        req.flash('error', 'Failed to fetch guest list');
        res.redirect('/');
    }
});

// Route to render member list
router.get('/members', isLoggedIn, isAdmin, async (req, res) => {
    try {
        const memberList = await NewMember.find({ card: { $ne: null } });
        res.render('admins/members', { memberList });
    } catch (err) {
        console.error('Error fetching member list:', err);
        req.flash('error', 'Failed to fetch member list');
        res.redirect('/');
    }
});

// Route to handle deletion by admin (common for both guests and members)
router.post('/delete/:id', isLoggedIn, isAdmin, async (req, res) => {
    const { id } = req.params;
    try {
        await NewMember.findByIdAndDelete(id);
        req.flash('success', 'User deleted successfully');
    } catch (err) {
        req.flash('error', 'Failed to delete user');
    }
    res.redirect(req.header('Referer') || '/');
});

// Route to view profile
router.get('/profile/:id', isLoggedIn, isAdmin, async (req, res) => {
    const { id } = req.params;
    try {
        const user = await NewMember.findById(id);
        if (!user) {
            req.flash('error', 'User not found');
            return res.redirect('/');
        }
        res.render('admins/profile', { user });
    } catch (err) {
        console.error('Error fetching user profile:', err);
        req.flash('error', 'Failed to fetch user profile');
        res.redirect('/');
    }
});

module.exports = router;
