const express = require('express');
const router = express.Router();
const catchAsync = require('../utils/catchAsync');
const Room = require('../models/room');
const Booking = require('../models/booking');
const { isLoggedIn, isAdmin, isAdminOrGuest, isGuest } = require('../middleware');
const ExcelJS = require('exceljs');


const getDatesInMonth = (year, month) => {
    const date = new Date(year, month, 1);
    const dates = [];
    while (date.getMonth() === month) {
        dates.push(new Date(date));
        date.setDate(date.getDate() + 1);
    }
    return dates;
};
router.get('/export/month', isLoggedIn, isAdmin, catchAsync(async (req, res) => {
    const { monthYear } = req.query;

    if (!monthYear) {
        req.flash('error', 'Month and year are required.');
        return res.redirect('/approvedBookings');
    }

    const [monthName, year] = monthYear.split(' ');
    const month = new Date(`${monthName} 1, ${year}`).getMonth();
    const startDate = new Date(Date.UTC(year, month, 1)); // Start of the month in UTC
    const endDate = new Date(Date.UTC(year, month + 1, 1)); // Start of the next month in UTC

    // Fetch bookings that overlap with the specified month
    const bookings = await Booking.find({
        status: 'Approved',
        $or: [
            { startDate: { $lt: endDate, $gte: startDate } },
            { endDate: { $gt: startDate, $lte: endDate } },
            { startDate: { $lt: startDate }, endDate: { $gt: endDate } }
        ]
    }).populate('user room');

    const rooms = await Room.find();

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet(monthYear);

    // Add header row with dates
    const dates = getDatesInMonth(year, month);
    const headerRow = ['Room Name', ...dates.map(date => date.getDate())];
    worksheet.addRow(headerRow);

    // Add rows with room names and booking data
    rooms.forEach(room => {
        const row = [room.roomName];
        dates.forEach(date => {
            // Create a date object for the current date in UTC
            const currentDate = new Date(Date.UTC(year, month, date.getDate()));

            // Check if there is a booking for the room on the current date
            const booking = bookings.find(booking =>
                booking.room._id.toString() === room._id.toString() &&
                new Date(booking.startDate) <= currentDate &&
                new Date(booking.endDate) > currentDate
            );

            if (booking) {
                const bookingStartDate = new Date(booking.startDate);
                const bookingEndDate = new Date(booking.endDate);

                // Adjust booking dates to UTC
                const adjustedStartDate = new Date(Date.UTC(bookingStartDate.getUTCFullYear(), bookingStartDate.getUTCMonth(), bookingStartDate.getUTCDate()));
                const adjustedEndDate = new Date(Date.UTC(bookingEndDate.getUTCFullYear(), bookingEndDate.getUTCMonth(), bookingEndDate.getUTCDate()));

                // Check if the current date falls within the adjusted booking date range
                if (currentDate >= adjustedStartDate && currentDate < adjustedEndDate) {
                    row.push(booking.user.name);
                } else {
                    row.push('');
                }
            } else {
                row.push('');
            }
        });
        worksheet.addRow(row);
    });

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${monthYear}.xlsx"`);

    await workbook.xlsx.write(res);
    res.end();
}));


router.delete('/delete/bookings/month', isAdmin, catchAsync(async (req, res) => {
    const { monthYear } = req.query;

    if (!monthYear) {
        req.flash('error', 'Month and year are required.');
        return res.redirect('/approvedBookings');
    }

    const [monthName, year] = monthYear.split(' ');
    const month = new Date(`${monthName} 1, ${year}`).getMonth();
    const startDate = new Date(Date.UTC(year, month, 1)); // Start of the month in UTC
    const endDate = new Date(Date.UTC(year, month + 1, 1)); // Start of the next month in UTC

    try {
        // Fetch bookings that overlap with the specified month
        const bookings = await Booking.find({
            status: 'Approved',
            $or: [
                { startDate: { $lt: endDate, $gte: startDate } },
                { endDate: { $gt: startDate, $lte: endDate } },
                { startDate: { $lt: startDate }, endDate: { $gt: endDate } }
            ]
        });

        // Delete all bookings within the specified month
        await Booking.deleteMany({
            _id: { $in: bookings.map(b => b._id) }
        });

        req.flash('success', 'Bookings deleted successfully.');
        res.redirect('/approvedBookings');
    } catch (error) {
        console.error('Error deleting bookings:', error);
        req.flash('error', 'Failed to delete bookings.');
        res.redirect('/approvedBookings');
    }
}));

// GET route for displaying the room creation form
router.get('/createRoom', isLoggedIn, isAdmin, (req, res) => {
    res.render('rooms/createRoom', { messages: req.flash() });
});

// POST route for handling room creation
router.post('/createRoom', isLoggedIn, isAdmin, catchAsync(async (req, res) => {
    const { roomName, capacity, isAvailable } = req.body;
    const room = new Room({ roomName, capacity, isAvailable });
    await room.save();
    req.flash('success', 'Successfully added a room');
    res.redirect('/roomlist'); // Redirect to the rooms list
}));


router.delete('/deleteBookings/:month', isAdmin, catchAsync(async (req, res) => {
    const month = req.params.month;
    try {
        // Convert month string back to date range
        const [monthName, year] = month.split(' ');
        const startDate = new Date(`${monthName} 1, ${year}`);
        const endDate = new Date(startDate);
        endDate.setMonth(endDate.getMonth() + 1);

        // Delete all bookings within the specified month
        await Booking.deleteMany({
            startDate: { $gte: startDate, $lt: endDate },
            status: 'Approved'
        });

        res.status(200).send({ success: true });
    } catch (error) {
        console.error(error);
        res.status(500).send({ error: 'Error deleting bookings' });
    }
}));

// POST route for deleting a room
router.post('/deleteRoom/:roomId', isLoggedIn, isAdmin, catchAsync(async (req, res) => {
    const { roomId } = req.params;

    // Check if the admin's card number allows deletion (-2 or -3)
    if (req.user.card !== -2 && req.user.card !== -3) {
        req.flash('error', 'Unauthorized to delete rooms');
        return res.redirect('/roomlist'); // Redirect to room list or appropriate page
    }

    // Implement logic to delete the room based on roomId
    await Room.findByIdAndDelete(roomId);
    await Booking.findByIdAndDelete(roomId);

    req.flash('success', 'Room deleted successfully');
    res.redirect('/roomlist'); // Redirect to the room list
}));


// GET route for listing all rooms
router.get('/roomlist', isLoggedIn, isAdminOrGuest, catchAsync(async (req, res) => {
    const rooms = await Room.find({});
    const bookings = await Booking.find({}).populate('user room'); // Populate room for room number

    const currentDate = new Date(); // Current date and time

    // Map through rooms and update status based on bookings
    const roomStatus = rooms.map(room => {
        try {
            // Find any booking that matches this room and is approved and active
            const bookedBooking = bookings.find(booking =>
                booking.room && booking.room.equals(room._id) && // Check if booking.room is not null or undefined
                booking.status === 'Approved' &&
                currentDate >= new Date(booking.startDate) &&
                currentDate < new Date(booking.endDate)
            );

            // Find any pending booking for this room
            const pendingBooking = bookings.find(booking =>
                booking.room && booking.room.equals(room._id) && // Check if booking.room is not null or undefined
                booking.status === 'Pending' &&
                currentDate >= new Date(booking.startDate) &&
                currentDate < new Date(booking.endDate)
            );

            // Determine userBookingStatus based on bookings
            if (bookedBooking) {
                // Room is booked
                return { ...room.toObject(), userBookingStatus: 'Booked', isAvailable: false };
            } else if (pendingBooking) {
                // Room has a pending booking
                return { ...room.toObject(), userBookingStatus: 'Pending', isAvailable: true };
            } else {
                // Room is available
                return { ...room.toObject(), userBookingStatus: 'Available', isAvailable: true };
            }
        } catch (error) {
            console.error('Error processing room:', error);
            return { ...room.toObject(), userBookingStatus: 'Error', isAvailable: false };
        }
    });

    // Sort rooms: available first, then pending, then not available
    roomStatus.sort((a, b) => {
        if (a.isAvailable && !b.isAvailable) return -1;
        if (!a.isAvailable && b.isAvailable) return 1;
        if (a.userBookingStatus === 'Pending' && b.userBookingStatus !== 'Pending') return -1;
        if (a.userBookingStatus !== 'Pending' && b.userBookingStatus === 'Pending') return 1;
        return 0;
    });

    // Render the room list with updated room status
    res.render('rooms/index', { rooms: roomStatus, messages: req.flash(), currentUser: req.user });
}));

// POST route for booking a room
router.post('/bookRoom/:roomId', isLoggedIn, catchAsync(async (req, res) => {
    const { roomId } = req.params;
    const { startDate, endDate } = req.body;

    // Check for date clashes with existing bookings
    const existingBooking = await Booking.findOne({
        room: roomId,
        status: 'Approved',
        $or: [
            { startDate: { $gte: new Date(startDate), $lt: new Date(endDate) } },
            { endDate: { $gt: new Date(startDate), $lte: new Date(endDate) } },
            { startDate: { $lt: new Date(startDate) }, endDate: { $gt: new Date(endDate) } }
        ]
    });


    if (existingBooking) {
        req.flash('error', 'Room is already booked for the selected dates');
        return res.redirect('/roomlist');
    }

    // Create new booking
    const booking = new Booking({
        user: req.user._id, // The user who is making the booking
        room: roomId,
        startDate,
        endDate,
        status: 'Pending' // Initial status
    });

    await booking.save();
    req.flash('success', 'Booking request submitted');
    res.redirect('/userBookings'); // Redirect to user bookings page
}));

// GET route for viewing booking requests (admin only)
router.get('/bookingRequests', isLoggedIn, isAdmin, catchAsync(async (req, res) => {
    const bookings = await Booking.find({ status: 'Pending' }).populate('user room');
    res.render('rooms/bookingRequests', { bookings, formatDate, messages: req.flash() });
}));

// GET route for viewing approved bookings (admin only)
// GET route for viewing approved bookings (admin only)
// GET route for viewing approved bookings (admin only

const getDatesInRange = (startDate, endDate) => {
    const dates = [];
    const currentDate = new Date(startDate);
    while (currentDate < endDate) {
        dates.push(new Date(currentDate));
        currentDate.setDate(currentDate.getDate() + 1);
    }
    return dates;
};

// GET route for viewing approved bookings (admin only)
router.get('/approvedBookings', isLoggedIn, catchAsync(async (req, res) => {
    try {
        const rooms = await Room.find();
        const bookings = await Booking.find({ status: 'Approved' })
            .populate('user')
            .populate('room');

        const groupedBookings = {};

        bookings.forEach(booking => {
            const startDate = new Date(booking.startDate);
            const endDate = new Date(booking.endDate);

            // Ensure startDate is before endDate
            if (startDate > endDate) {
                return;
            }

            // Handle bookings that span multiple months or years
            const startMonthYear = formatMonthYear(startDate);
            const endMonthYear = formatMonthYear(endDate);

            if (startMonthYear !== endMonthYear) {
                // Split the booking into two parts if they span across months or years
                const startMonthEnd = new Date(startDate.getFullYear(), startDate.getMonth() + 1, 1);
                const endMonthStart = new Date(endDate.getFullYear(), endDate.getMonth(), 1);

                if (!groupedBookings[startMonthYear]) {
                    groupedBookings[startMonthYear] = { dates: {}, bookings: [] };
                }
                const startMonthDates = getDatesInRange(startDate, startMonthEnd);
                startMonthDates.forEach(date => {
                    if (!groupedBookings[startMonthYear].dates[date.getDate()]) {
                        groupedBookings[startMonthYear].dates[date.getDate()] = [];
                    }
                    groupedBookings[startMonthYear].dates[date.getDate()].push({
                        ...booking.toObject(),
                        startDate: date,
                        endDate: startMonthEnd
                    });
                });

                if (!groupedBookings[endMonthYear]) {
                    groupedBookings[endMonthYear] = { dates: {}, bookings: [] };
                }
                endDate.setDate(endDate.getDate() - 1);
                const endMonthDates = getDatesInRange(endMonthStart, endDate);
                endMonthDates.forEach(date => {
                    if (!groupedBookings[endMonthYear].dates[date.getDate()]) {
                        groupedBookings[endMonthYear].dates[date.getDate()] = [];
                    }
                    groupedBookings[endMonthYear].dates[date.getDate()].push({
                        ...booking.toObject(),
                        startDate: endMonthStart,
                        endDate: date
                    });
                });

                groupedBookings[startMonthYear].bookings.push({
                    ...booking.toObject(),
                    startDate,
                    endDate: startMonthEnd
                });
                groupedBookings[endMonthYear].bookings.push({
                    ...booking.toObject(),
                    startDate: endMonthStart,
                    endDate
                });
            } else {
                // Handle bookings within a single month-year
                if (!groupedBookings[startMonthYear]) {
                    groupedBookings[startMonthYear] = { dates: {}, bookings: [] };
                }
                const datesInRange = getDatesInRange(startDate, endDate);
                datesInRange.forEach(date => {
                    if (!groupedBookings[startMonthYear].dates[date.getDate()]) {
                        groupedBookings[startMonthYear].dates[date.getDate()] = [];
                    }
                    groupedBookings[startMonthYear].dates[date.getDate()].push({
                        ...booking.toObject(),
                        startDate: date,
                        endDate: endDate
                    });
                });
                groupedBookings[startMonthYear].bookings.push({
                    ...booking.toObject(),
                    startDate,
                    endDate
                });
            }
        });

        const monthNames = ["January", "February", "March", "April", "May", "June",
            "July", "August", "September", "October", "November", "December"];

        res.render('rooms/approvedBookings', { rooms, groupedBookings, monthNames, formatDate, messages: req.flash() });
    } catch (error) {
        console.error('Error fetching approved bookings:', error);
        req.flash('error', 'Failed to fetch approved bookings');
        res.redirect('/');
    }
}));


const formatMonthYear = (date) => {
    const monthNames = ["January", "February", "March", "April", "May", "June",
        "July", "August", "September", "October", "November", "December"];
    return `${monthNames[date.getMonth()]} ${date.getFullYear()}`;
};

// Helper function to format date
function formatDate(date) {
    if (!(date instanceof Date)) {
        throw new Error('The provided value is not a Date object');
    }

    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0'); // Months are zero-based
    const year = date.getFullYear();

    return `${day}-${month}-${year}`;
}

// Helper function to find booking for a specific date and room
function findBookingForDate(bookings, roomId, date) {
    return bookings.find(booking =>
        booking.room._id.toString() === roomId.toString() &&
        date >= new Date(booking.startDate).getDate() &&
        date < new Date(booking.endDate).getDate() // Include the end date
    );
}




// Helper function to find booking for a specific date and room





// POST route for approving/rejecting booking requests (admin only)
router.post('/bookingRequests/:bookingId/:action', isLoggedIn, isAdmin, catchAsync(async (req, res) => {
    const { bookingId, action } = req.params;
    const booking = await Booking.findById(bookingId).populate('user room');

    if (!booking) {
        req.flash('error', 'Booking request not found');
        return res.redirect('/bookingRequests');
    }

    if (action === 'approve') {
        // Check for date clashes with existing approved bookings
        const existingApprovedBooking = await Booking.findOne({
            room: booking.room,
            status: 'Approved',
            $or: [
                { startDate: { $gte: new Date(booking.startDate), $lt: new Date(booking.endDate) } },
                { endDate: { $gt: new Date(booking.startDate), $lte: new Date(booking.endDate) } },
                { startDate: { $lte: new Date(booking.startDate) }, endDate: { $gte: new Date(booking.endDate) } }
            ]
        });

        if (existingApprovedBooking) {
            req.flash('error', 'Room is already booked for the selected dates');
            return res.redirect('/bookingRequests');
        }

        // Approve the current booking
        booking.status = 'Approved';
        await booking.save();

        // Reject other pending bookings that clash with the approved booking's dates
        const otherPendingBookings = await Booking.find({
            room: booking.room,
            status: 'Pending',
            _id: { $ne: booking._id },
            $or: [
                { startDate: { $gte: new Date(booking.startDate), $lt: new Date(booking.endDate) } },
                { endDate: { $gt: new Date(booking.startDate), $lte: new Date(booking.endDate) } },
                { startDate: { $lte: new Date(booking.startDate) }, endDate: { $gte: new Date(booking.endDate) } }
            ]
        });

        for (let pendingBooking of otherPendingBookings) {
            pendingBooking.status = 'Rejected';
            await pendingBooking.save();
        }

        req.flash('success', `Booking request approved for ${booking.user.name}`);
    } else {
        booking.status = 'Rejected';
        await booking.save();
        req.flash('success', `Booking request rejected for ${booking.user.name}`);
    }

    res.redirect('/bookingRequests');
}));


// POST route for withdrawing a booking
// POST route for withdrawing a booking
// POST route for withdrawing a booking
router.post('/withdrawBooking/:bookingId', isLoggedIn, isGuest, catchAsync(async (req, res) => {
    const { bookingId } = req.params;

    // Find the booking and ensure the user is the one who made the booking
    const booking = await Booking.findById(bookingId);
    if (!booking) {
        req.flash('error', 'Booking not found');
        return res.redirect('/userBookings');
    }

    if (!booking.user.equals(req.user._id)) {
        req.flash('error', 'Unauthorized to withdraw this booking');
        return res.redirect('/userBookings');
    }

    // Update booking status to 'Withdrawn'
    booking.status = 'Withdrawn';
    await booking.save();

    req.flash('success', 'Booking successfully withdrawn');
    res.redirect('/userBookings');
}));




// GET route for displaying the user's bookings
// GET route for displaying the user's bookings
router.get('/userBookings', isLoggedIn, isGuest, catchAsync(async (req, res) => {
    const bookings = await Booking.find({ user: req.user._id }).populate('room');
    res.render('rooms/booking', { bookings, formatDate, messages: req.flash() });
}));




router.get('/delete/month', async (req, res) => {
    const { monthYear } = req.query;

    if (!monthYear) {
        return res.status(400).send('Month and year are required.');
    }

    try {
        const [monthName, year] = monthYear.split(' ');
        const startDate = new Date(`${monthName} 1, ${year}`);
        const endDate = new Date(startDate);
        endDate.setMonth(endDate.getMonth() + 1);

        await Booking.deleteMany({
            startDate: { $gte: startDate, $lt: endDate },
            status: 'Approved'
        });

        // Redirect or respond after successful deletion
        res.redirect('/approvedBookings'); // Redirect to the approved bookings page
    } catch (error) {
        console.error('Error deleting bookings:', error);
        res.status(500).send('An error occurred while deleting bookings.');
    }
});


module.exports = router;