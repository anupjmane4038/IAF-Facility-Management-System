const flash = require('connect-flash');

module.exports.isLoggedIn = (req, res, next) => {
    if (!req.isAuthenticated()) {
        req.session.returnTo = req.originalUrl;
        req.flash('error', 'You must be signed in first!');
        return res.redirect('/login');
    }
    next();
};

module.exports.isAdmin = (req, res, next) => {
    // Check if user is logged in and isAdmin or has specific cards
    if (req.user && (req.user.email === 'admin@gmail.com' && req.user.card === -1 ||
        req.user.email === 'pmc@gmail.com' && req.user.card === -2)) {
        next(); // User is admin or has specific cards, proceed
    } else {
        req.flash('error', 'You do not have permission to access this page');
        res.redirect('/'); // Redirect to homepage or login page
    }
};

module.exports.isMember = async (req, res, next) => {
    if (req.user && req.user.card !== -1 && req.user.card !== -2 && req.user.card !== null) {
        return next();
    } else {
        req.flash('error', 'First log in as a member');
        return res.redirect('/login');
    }
};


module.exports.isAdminOrGuest = async (req, res, next) => {
    if (req.user && (req.user.card === -1 || req.user.card === -2 || !req.user.card)) {
        return next();
    } else {
        req.flash('error', 'First log in as Admin or Guest');
        return res.redirect('/login');
    }
};



module.exports.isGuest = async (req, res, next) => {
    if (req.user && (!req.user.card)) {
        next();
    } else {
        req.flash('error', 'First log in as a guest');
        return res.redirect('/login');
    }
};

