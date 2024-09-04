const express = require('express');
const router = express.Router();
const catchAsync = require('../utils/catchAsync');
const Leave = require('../models/leave');
const User = require('../models/user');
const { isLoggedIn, isAdmin, isMember } = require('../middleware');
const flash = require('connect-flash');
const ExcelJS = require('exceljs');

// Helper function to format date into Month Year format
const formatMonthYear = (date) => {
    const d = new Date(date);
    const monthNames = ["January", "February", "March", "April", "May", "June",
        "July", "August", "September", "October", "November", "December"];
    return `${monthNames[d.getMonth()]} ${d.getFullYear()}`;
};

function formatDate(dateString) {
    const date = new Date(dateString);
    const day = date.getDate().toString().padStart(2, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0'); // January is 0
    const year = date.getFullYear();
    return `${day}-${month}-${year}`;
}

// Helper function to split leaves spanning multiple months
const splitLeavesByMonth = (leave) => {
    const startDate = new Date(leave.leaveStartDate);
    const endDate = new Date(leave.leaveEndDate);
    const leaves = [];

    // Start processing from the start date
    let currentStartDate = new Date(startDate);

    // Loop until we reach the end date
    while (currentStartDate < endDate) {
        // Determine the last day of the current month
        const currentMonth = currentStartDate.getMonth();
        const currentYear = currentStartDate.getFullYear();
        const lastDayOfCurrentMonth = new Date(currentYear, currentMonth + 1, 1); // Last day of current month

        // Determine the split end date
        let splitEndDate;

        // If we are in the last month of the leave period
        if (currentStartDate.getMonth() === endDate.getMonth() && currentStartDate.getFullYear() === endDate.getFullYear()) {
            splitEndDate = new Date(endDate); // Use the end date
        } else {
            // Set splitEndDate to the first day of the next month
            splitEndDate = new Date(currentYear, currentMonth + 1, 1); // First day of next month
        }

        // Ensure splitEndDate does not exceed the last day of the current month
        if (splitEndDate > lastDayOfCurrentMonth) {
            splitEndDate = lastDayOfCurrentMonth; // Last day of the current month
        }

        // Calculate total leaves rounded to the nearest integer
        const totalLeaves = Math.round((splitEndDate - currentStartDate) / (1000 * 60 * 60 * 24)); // Total days (exclusive of end date)

        // Create a leave object for the current month
        leaves.push({
            card: leave.card,
            leaveStartDate: currentStartDate,
            leaveEndDate: splitEndDate,
            totalLeaves: totalLeaves // Ensure totalLeaves is rounded to the nearest integer
        });

        // Move to the first day of the next month
        currentStartDate = new Date(currentYear, currentMonth + 1, 1);
    }

    return leaves;
};

router.get('/leavelist', isLoggedIn, isAdmin, catchAsync(async (req, res) => {
    const leavelist = await Leave.find({}).sort({ leaveStartDate: -1 }); // Sort by leave start date descending
    const users = await User.find({}); // Fetch all users
    const leavesByMonthYear = {}; // Group leaves by month and year
    const currentYear = new Date().getFullYear();

    // Filter out users with card -1, -2, or null
    const filteredUsers = users.filter(user => user.card && user.card !== -1 && user.card !== -2);

    // Group leaves by month and year, splitting leaves spanning multiple months
    leavelist.forEach(leave => {
        const splitLeaves = splitLeavesByMonth(leave);

        splitLeaves.forEach(splitLeave => {
            const monthYear = formatMonthYear(splitLeave.leaveStartDate);
            if (!leavesByMonthYear[monthYear]) {
                leavesByMonthYear[monthYear] = {};
            }
            if (!leavesByMonthYear[monthYear][splitLeave.card]) {
                leavesByMonthYear[monthYear][splitLeave.card] = {
                    card: splitLeave.card,
                    totalLeaves: 0,
                    leaves: []
                };
            }
            leavesByMonthYear[monthYear][splitLeave.card].totalLeaves += splitLeave.totalLeaves;
            leavesByMonthYear[monthYear][splitLeave.card].leaves.push(splitLeave);
        });
    });

    // Ensure all filtered users are included in the leave list, even if they have not applied for leave
    filteredUsers.forEach(user => {
        Object.keys(leavesByMonthYear).forEach(monthYear => {
            if (!leavesByMonthYear[monthYear][user.card]) {
                leavesByMonthYear[monthYear][user.card] = {
                    card: user.card,
                    totalLeaves: 0,
                    leaves: []
                };
            }
        });
    });

    res.render('admins/leavelist', { leavesByMonthYear, currentYear, formatDate });
}));


router.get('/export/:month/:year', isLoggedIn, isAdmin, catchAsync(async (req, res) => {
    const { month, year } = req.params;
    const monthStart = new Date(`${year}-${month.padStart(2, '0')}-01`);
    const monthEnd = new Date(new Date(monthStart).setMonth(monthStart.getMonth() + 1));

    const leaves = await Leave.find({
        leaveStartDate: { $lte: monthEnd },
        leaveEndDate: { $gte: monthStart }
    });

    const users = await User.find({}); // Fetch all users to get full names

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Leaves');

    worksheet.columns = [
        { header: 'Card Number', key: 'card', width: 15 },
        { header: 'Username', key: 'username', width: 15 },
        { header: 'Full Name', key: 'fullName', width: 25 },
        { header: 'Rank', key: 'rank', width: 15 },
        { header: 'Total Leaves', key: 'totalLeaves', width: 15 },
        { header: 'Active Days', key: 'activeDays', width: 15 } // Add Active Days column
    ];

    const leaveSummary = {};

    // Accumulate leaves for each card number
    leaves.forEach(leave => {
        const splitLeaves = splitLeavesByMonth(leave);
        splitLeaves.forEach(splitLeave => {
            if (splitLeave.leaveStartDate < monthEnd && splitLeave.leaveEndDate >= monthStart) {
                if (!leaveSummary[splitLeave.card]) {
                    leaveSummary[splitLeave.card] = {
                        card: splitLeave.card,
                        totalLeaves: 0,
                        activeDays: 0 // Initialize activeDays
                    };
                }

                leaveSummary[splitLeave.card].totalLeaves += splitLeave.totalLeaves;
            }
        });
    });

    // Calculate total days in the month
    const totalDaysInMonth = Math.round((monthEnd - monthStart) / (1000 * 60 * 60 * 24));

    // Add rows to the worksheet
    users.forEach(user => {
        const card = user.card ? user.card.toString().trim() : null; // Handle null values
        if (card === '-1' || card === '-2' || card === null) {
            console.log(`Skipping card: ${card}`); // Debug log
            return; // Skip users with card numbers -1, -2, or null
        }
        const fullName = user.name;
        const username = user.username;
        const rank = user.rank;
        const totalLeaves = leaveSummary[card] ? leaveSummary[card].totalLeaves : 0;
        const activeDays = totalDaysInMonth - totalLeaves; // Calculate Active Days

        worksheet.addRow({
            card,
            username,
            rank,
            fullName,
            totalLeaves,
            activeDays // Include Active Days in the row
        });
    });

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=leaves-${month}-${year}.xlsx`);

    await workbook.xlsx.write(res);
    res.end();
}));

router.delete('/leavelist/delete/:monthYear', isLoggedIn, isAdmin, catchAsync(async (req, res) => {
    // Decode the URL-encoded parameter
    const monthYear = decodeURIComponent(req.params.monthYear);
    const [month, year] = monthYear.split(' ');

    // Validate and format month and year
    if (!month || !year || !monthNames.includes(month)) {
        return res.status(400).json({ message: 'Invalid month or year format.' });
    }

    const monthIndex = monthNames.indexOf(month); // Get the month index
    const monthStart = new Date(year, monthIndex, 1); // First day of the month
    const monthEnd = new Date(year, monthIndex + 1, 1); // Last day of the month

    // Delete leaves that start or end within the specified month
    const result = await Leave.deleteMany({
        $or: [
            { leaveStartDate: { $lte: monthEnd, $gte: monthStart } },
            { leaveEndDate: { $lte: monthEnd, $gte: monthStart } }
        ]
    });

    res.status(200).json({
        message: `Deleted ${result.deletedCount} leaves overlapping with ${monthYear}`,
    });
}));

const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
];


module.exports = router;