const express = require('express');
const { body, validationResult } = require('express-validator');
const Booking = require('../models/Booking');
const Car = require('../models/Car');
const User = require('../models/User');
const auth = require('../middleware/auth');
const moment = require('moment');
const router = express.Router();

// @route   POST /api/bookings
// @desc    Create new booking
// @access  Private
router.post('/', [auth], [
  body('car').notEmpty().withMessage('Car ID is required'),
  body('startDate').isISO8601().withMessage('Start date must be a valid date'),
  body('endDate').isISO8601().withMessage('End date must be a valid date'),
  body('pickupLocation').notEmpty().withMessage('Pickup location is required'),
  body('returnLocation').notEmpty().withMessage('Return location is required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { car: carId, startDate, endDate, pickupLocation, returnLocation, specialRequests } = req.body;

    // Validate dates
    const start = new Date(startDate);
    const end = new Date(endDate);
    const now = new Date();

    if (start <= now) {
      return res.status(400).json({
        success: false,
        message: 'Start date must be in the future'
      });
    }

    if (end <= start) {
      return res.status(400).json({
        success: false,
        message: 'End date must be after start date'
      });
    }

    // Check if car exists and is available
    const car = await Car.findById(carId);
    if (!car) {
      return res.status(404).json({
        success: false,
        message: 'Car not found'
      });
    }

    if (!car.isAvailable) {
      return res.status(400).json({
        success: false,
        message: 'Car is not available'
      });
    }

    // Check for conflicting bookings
    const conflictingBookings = await Booking.find({
      car: carId,
      status: { $in: ['confirmed', 'active'] },
      $or: [
        {
          startDate: { $lte: end },
          endDate: { $gte: start }
        }
      ]
    });

    if (conflictingBookings.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Car is not available for the selected dates'
      });
    }

    // Calculate total amount
    const totalDays = Math.ceil((end.getTime() - start.getTime()) / (1000 * 3600 * 24));
    const totalAmount = totalDays * car.pricePerDay;

    // Create booking
    const booking = await Booking.create({
      user: req.user.id,
      car: carId,
      startDate: start,
      endDate: end,
      totalDays,
      totalAmount,
      pickupLocation,
      returnLocation,
      specialRequests
    });

    // Populate car details
    await booking.populate('car', 'name brand model images pricePerDay');

    res.status(201).json({
      success: true,
      message: 'Booking created successfully',
      data: booking
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
});

// @route   GET /api/bookings
// @desc    Get user's bookings
// @access  Private
router.get('/', auth, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    let query = { user: req.user.id };
    
    // Filter by status
    if (req.query.status) {
      query.status = req.query.status;
    }

    const bookings = await Booking.find(query)
      .populate('car', 'name brand model images category pricePerDay')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await Booking.countDocuments(query);

    res.json({
      success: true,
      data: bookings,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
});

// @route   GET /api/bookings/:id
// @desc    Get booking by ID
// @access  Private
router.get('/:id', auth, async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id)
      .populate('car')
      .populate('user', 'name email phone');

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: 'Booking not found'
      });
    }

    // Check if user owns the booking or is admin
    if (booking.user._id.toString() !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to access this booking'
      });
    }

    res.json({
      success: true,
      data: booking
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
});

// @route   POST /api/bookings/guest
// @desc    Create guest booking (no authentication required)
// @access  Public
router.post('/guest', [
  body('car').notEmpty().withMessage('Car ID is required'),
  body('startDate').isISO8601().withMessage('Start date must be a valid date'),
  body('endDate').isISO8601().withMessage('End date must be a valid date'),
  body('pickupLocation').notEmpty().withMessage('Pickup location is required'),
  body('returnLocation').notEmpty().withMessage('Return location is required'),
  body('guestInfo.name').notEmpty().withMessage('Guest name is required'),
  body('guestInfo.email').isEmail().withMessage('Valid email is required'),
  body('guestInfo.phone').notEmpty().withMessage('Phone number is required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { 
      car: carId, 
      startDate, 
      endDate, 
      pickupLocation, 
      returnLocation, 
      specialRequests,
      guestInfo 
    } = req.body;

    // Validate dates
    const start = new Date(startDate);
    const end = new Date(endDate);
    const now = new Date();

    if (start <= now) {
      return res.status(400).json({
        success: false,
        message: 'Start date must be in the future'
      });
    }

    if (end <= start) {
      return res.status(400).json({
        success: false,
        message: 'End date must be after start date'
      });
    }

    // Check if car exists and is available
    const car = await Car.findById(carId);
    if (!car) {
      return res.status(404).json({
        success: false,
        message: 'Car not found'
      });
    }

    if (!car.isAvailable) {
      return res.status(400).json({
        success: false,
        message: 'Car is not available'
      });
    }

    // Check for conflicting bookings
    const conflictingBookings = await Booking.find({
      car: carId,
      status: { $in: ['confirmed', 'active', 'pending'] },
      $or: [
        {
          startDate: { $lte: end },
          endDate: { $gte: start }
        }
      ]
    });

    if (conflictingBookings.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Car is not available for the selected dates'
      });
    }

    // Calculate total amount
    const totalDays = Math.ceil((end.getTime() - start.getTime()) / (1000 * 3600 * 24));
    const totalAmount = totalDays * car.pricePerDay;

    // Create or find guest user
    let guestUser = await User.findOne({ email: guestInfo.email, isGuest: true });
    
    if (!guestUser) {
      guestUser = await User.create({
        name: guestInfo.name,
        email: guestInfo.email,
        phone: guestInfo.phone,
        role: 'guest',
        isGuest: true
      });
    } else {
      // Update guest info if user exists
      guestUser.name = guestInfo.name;
      guestUser.phone = guestInfo.phone;
      await guestUser.save();
    }

    // Create booking
    const booking = await Booking.create({
      user: guestUser._id,
      car: carId,
      startDate: start,
      endDate: end,
      totalDays,
      totalAmount,
      pickupLocation,
      returnLocation,
      specialRequests,
      status: 'pending',
      isGuestBooking: true,
      guestInfo: {
        name: guestInfo.name,
        email: guestInfo.email,
        phone: guestInfo.phone
      }
    });

    // Populate car details
    await booking.populate('car', 'name brand model images pricePerDay category');

    res.status(201).json({
      success: true,
      message: 'Guest booking created successfully! We will contact you shortly to confirm your reservation.',
      data: booking
    });
  } catch (error) {
    console.error('Guest booking error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
});

// @route   PUT /api/bookings/:id/cancel
// @desc    Cancel booking
//
module.exports = router;
