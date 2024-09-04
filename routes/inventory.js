const express = require('express');
const router = express.Router();
const Category = require('../models/category');
const User = require('../models/user');
const { isLoggedIn, isAdmin, isMember } = require('../middleware');

// Admin Routes


router.get('/admin/categories-list', isLoggedIn, isAdmin, async (req, res) => {
    try {
        // Fetch all categories
        const categories = await Category.find().populate('custodian');
        res.render('admins/categories-list', { categories });
    } catch (err) {
        res.status(500).send(err.message);
    }
});


router.get('/admin/manage-categories', isLoggedIn, isAdmin, async (req, res) => {
    try {
        const users = await User.find(); // Fetch users for custodian selection
        res.render('admins/manage-categories', { users });
    } catch (err) {
        res.status(500).send(err.message);
    }
});

// Route to handle category creation
// Route to handle category creation
router.post('/admin/create-category', isLoggedIn, isAdmin, async (req, res) => {
    try {
        const { name, custodianId } = req.body;
        const items = req.body.items.map(item => ({
            name: item.name,
            quantity: item.quantity
        }));

        // Check if a category with the same name already exists
        const existingCategory = await Category.findOne({ name });
        if (existingCategory) {
            req.flash('error', 'Category with this name already exists.');
            return res.redirect('/admin/manage-categories');
        }

        if (custodianId) {
            // Check if custodian is already assigned to another category
            const existingCustodianCategory = await Category.findOne({ custodian: custodianId });
            if (existingCustodianCategory) {
                // Clear the custodian's previous assignment
                await User.findByIdAndUpdate(custodianId, { permanentCategory: null });
                existingCustodianCategory.custodian = null;
                await existingCustodianCategory.save();
            }
        }

        const newCategory = new Category({
            name,
            items,
            custodian: custodianId
        });

        await newCategory.save();

        if (custodianId) {
            await User.findByIdAndUpdate(custodianId, { permanentCategory: newCategory._id });
        }

        req.flash('success', 'Category created successfully.');
        res.redirect('/admin/categories-list');
    } catch (err) {
        req.flash('error', 'An error occurred. Please try again.');
        res.redirect('/admin/manage-categories');
    }
});


// Route to change the custodian of a category
// Route to change the custodian of a category
router.post('/admin/change-custodian/:categoryId', isLoggedIn, isAdmin, async (req, res) => {
    try {
        const { newCustodianId } = req.body;
        const { categoryId } = req.params;
        const category = await Category.findById(categoryId);
        const oldCustodianId = category.custodian;

        if (oldCustodianId) {
            // Remove the category from the old custodian
            await User.findByIdAndUpdate(oldCustodianId, { permanentCategory: null });
        }

        if (newCustodianId) {
            // Ensure the new custodian is not already assigned to another category
            const existingCategory = await Category.findOne({ custodian: newCustodianId });
            if (existingCategory) {
                // Clear the existing custodian's previous assignment
                await User.findByIdAndUpdate(newCustodianId, { permanentCategory: null });
                existingCategory.custodian = null;
                await existingCategory.save();
            }
            // Assign the category to the new custodian
            await User.findByIdAndUpdate(newCustodianId, { permanentCategory: categoryId });
        }

        category.custodian = newCustodianId;
        await category.save();

        res.redirect(`/admin/category/${categoryId}`);
    } catch (err) {
        res.status(500).send(err.message);
    }
});


// Custodian Routes


// Route to view the category details and users for custodian change
// Route to view the category details and users for custodian change
router.get('/admin/category/:categoryId', isLoggedIn, isAdmin, async (req, res) => {
    try {
        // Fetch the category and its custodian
        const category = await Category.findById(req.params.categoryId).populate('custodian');

        // Fetch all users
        const users = await User.find();

        // Find custodians who are already assigned to a category
        const assignedCustodians = await Category.find({ custodian: { $ne: null } }).distinct('custodian');

        // Filter out users who are already custodians
        const availableUsers = users.filter(user => !assignedCustodians.includes(user._id.toString()));

        res.render('admins/category', { category, availableUsers });
    } catch (err) {
        res.status(500).send(err.message);
    }
});



// Route to delete an item
router.post('/admin/category/:categoryId/delete-item/:itemId', isLoggedIn, isAdmin, async (req, res) => {
    const { categoryId, itemId } = req.params;

    try {
        // Find the category
        const category = await Category.findById(categoryId);

        if (!category) {
            return res.status(404).send('Category not found');
        }

        // Find the item index in the category
        const itemIndex = category.items.findIndex(item => item._id.toString() === itemId);

        if (itemIndex === -1) {
            return res.status(404).send('Item not found');
        }

        // Remove the item
        category.items.splice(itemIndex, 1);
        await category.save();

        // Redirect or respond with success
        res.redirect(`/admin/category/${categoryId}`);
    } catch (err) {
        console.error(err);
        res.status(500).send('Server error');
    }
});

// Route to add or update items in a category
router.post('/admin/category/:id/add-item', isLoggedIn, isAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const { name, quantity } = req.body;

        const category = await Category.findById(id);

        if (!category) {
            return res.status(404).send('Category not found');
        }

        // Convert item name to lowercase
        const normalizedItemName = name.toLowerCase();

        // Check if the item already exists
        const existingItem = category.items.find(item => item.name === normalizedItemName);

        if (existingItem) {
            // If item exists, update its quantity
            existingItem.quantity += parseInt(quantity, 10);
        } else {
            // If item does not exist, add it to the items array
            category.items.push({ name: normalizedItemName, quantity: parseInt(quantity, 10) });
        }

        await category.save();
        res.redirect(`/admin/category/${id}`); // Redirect back to the category details page
    } catch (err) {
        res.status(500).send(err.message);
    }
});


// Route to view the user's assigned category and items
router.get('/user/my-category', isMember, async (req, res) => {
    try {
        // Assuming you are using authentication middleware that attaches `req.user`
        const user = req.user; // Fetch the currently logged-in user from `req.user`

        if (!user || !user.permanentCategory) {
            return res.render('custodian/categories', { error: 'No assigned category found.' });
        }

        // Fetch the assigned category for the user
        const category = await Category.findById(user.permanentCategory).populate('custodian');

        if (!category) {
            return res.render('custodian/categories', { error: 'Category not found.' });
        }

        res.render('custodian/categories', { category });
    } catch (err) {
        res.render('custodian/categories', { error: err.message });
    }
});



// Route to update item quantity
router.post('/user/category/:id/update-item/:itemId', isLoggedIn, isAdmin, async (req, res) => {
    const { id, itemId } = req.params;
    const { quantity } = req.body;

    try {
        // Fetch the category
        const category = await Category.findById(id);

        if (!category) {
            return res.status(404).send('Category not found');
        }

        // Find the item in the category
        const item = category.items.id(itemId);

        if (!item) {
            return res.status(404).send('Item not found');
        }

        // Update the item's quantity
        item.quantity = parseInt(quantity, 10);

        await category.save();

        res.redirect('/admin/categories-list');
    } catch (err) {
        res.status(500).send(err.message);
    }
});



module.exports = router;
