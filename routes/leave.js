const express = require('express');
const router = express.Router();
const catchAsync = require('../utils/catchAsync');
const Leave = require('../models/leave');
const { isLoggedIn, isAdmin, isMember } = require('../middleware');
const flash = require('connect-flash');

router.get('/putleave', isLoggedIn, isMember, (req, res) => {
    res.render('members/leave')
})

router.post('/putleave', isLoggedIn, isMember, async (req, res) => {
    try {
        const date1 = new Date(req.body.leaveStartDate);
        const date2 = new Date(req.body.leaveEndDate);
        var leaves;
        const time_difference = date2.getTime() - date1.getTime();
        if (time_difference === 0) {
            leaves = 1; // One day leave if start and end date are the same
        } else {
            leaves = Math.ceil(time_difference / (1000 * 60 * 60 * 24)); // Calculate the number of days
        }

        const leave = await Leave.create({
            card: req.body.card,
            name: req.body.name,
            leaveStartDate: req.body.leaveStartDate,
            leaveEndDate: req.body.leaveEndDate,
            totalLeaves: leaves,
            createdAt: Date.now() // Add createdAt field
        });

        req.flash('success', `Leave recorded successfully for ${leave.name} for ${leave.totalLeaves} day(s).`);
        res.redirect('/putleave');
    } catch (err) {
        req.flash('error', 'An error occurred while recording the leave. Please try again.');
        res.redirect('/putleave');
    }
});



module.exports = router;