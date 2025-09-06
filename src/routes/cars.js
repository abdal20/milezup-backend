const express = require('express');
const { body, query, validationResult } = require('express-validator');
const Car = require('../models/Car');
const Booking = require('../models/Booking');
const auth = require('../middleware/auth');
const admin = require('../middleware/admin');
const router = express.Router();

// @route   GET /api/cars
// @desc    Get all cars with filtering and pagination
// @access  Public
router.get('/', [
  query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
  query('limit').optional().isInt({ min: 1, max: 50 }).withMessage('Limit must be between 1 and 50'),
  query('minPrice').optional().isFloat({ min: 0 }).withMessage('Min price must be positive'),
  query('maxPrice').optional().isFloat({ min: 0 }).withMessage('Max price must be positive')
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

    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    // Build query
    let query = { isAvailable: true };

    // Filters
    if (req.query.category) query.category = req.query.category;
    if (req.query.transmission) query.transmission = req.query.transmission;
    if (req.query.fuelType) query.fuelType = req.query.fuelType;
    if (req.query.location) query.location = new RegExp(req.query.location, 'i');
    
    // Price range
    if (req.query.minPrice || req.query.maxPrice) {
      query.pricePerDay = {};
      if (req.query.minPrice) query.pricePerDay.$gte = parseFloat(req.query.minPrice);
      if (req.query.maxPrice) query.pricePerDay.$lte = parseFloat(req.query.maxPrice);
    }

    // Seats filter
    if (req.query.seats) query.seats = { $gte: parseInt(req.query.seats) };

    // Search by text
    if (req.query.search) {
      query.$text = { $search: req.query.search };
    }

    // Sort options
    let sort = {};
    switch (req.query.sortBy) {
      case 'price_low':
        sort.pricePerDay = 1;
        break;
      case 'price_high':
        sort.pricePerDay = -1;
        break;
      case 'rating':
        sort['rating.average'] = -1;
        break;
      case 'newest':
        sort.createdAt = -1;
        break;
      default:
        sort.createdAt = -1;
    }

    const cars = await Car.find(query)
      .sort(sort)
      .skip(skip)
      .limit(limit)
      .lean();

    const total = await Car.countDocuments(query);

    res.json({
      success: true,
      data: cars,
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

// @route   GET /api/cars/:id
// @desc    Get car by ID
// @access  Public
router.get('/:id', async (req, res) => {
  try {
    const car = await Car.findById(req.params.id);
    
    if (!car) {
      return res.status(404).json({
        success: false,
        message: 'Car not found'
      });
    }

    res.json({
      success: true,
      data: car
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
});

// @route   GET /api/cars/:id/availability
// @desc    Check car availability for given dates
// @access  Public
router.get('/:id/availability', [
  query('startDate').isISO8601().withMessage('Start date must be a valid date'),
  query('endDate').isISO8601().withMessage('End date must be a valid date')
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

    const { startDate, endDate } = req.query;
    const carId = req.params.id;

    // Check if car exists
    const car = await Car.findById(carId);
    if (!car) {
      return res.status(404).json({
        success: false,
        message: 'Car not found'
      });
    }

    // Check for overlapping bookings
    const conflictingBookings = await Booking.find({
      car: carId,
      status: { $in: ['confirmed', 'active'] },
      $or: [
        {
          startDate: { $lte: new Date(endDate) },
          endDate: { $gte: new Date(startDate) }
        }
      ]
    });

    const isAvailable = conflictingBookings.length === 0 && car.isAvailable;

    res.json({
      success: true,
      available: isAvailable,
      conflictingDates: conflictingBookings.map(booking => ({
        startDate: booking.startDate,
        endDate: booking.endDate
      }))
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
});

// @route   POST /api/cars
// @desc    Create new car (Admin only)
// @access  Private/Admin
router.post('/', [auth, admin], [
  body('name').notEmpty().withMessage('Car name is required'),
  body('brand').notEmpty().withMessage('Brand is required'),
  body('model').notEmpty().withMessage('Model is required'),
  body('year').isInt({ min: 1900, max: new Date().getFullYear() + 1 }).withMessage('Invalid year'),
  body('category').isIn(['economy', 'compact', 'midsize', 'fullsize', 'premium', 'luxury', 'suv', 'van', 'sports', 'electric']).withMessage('Invalid category'),
  body('pricePerDay').isFloat({ min: 0 }).withMessage('Price per day must be positive'),
  body('seats').isInt({ min: 1, max: 15 }).withMessage('Seats must be between 1 and 15'),
  body('transmission').isIn(['manual', 'automatic', 'cvt']).withMessage('Invalid transmission type'),
  body('fuelType').isIn(['gasoline', 'diesel', 'electric', 'hybrid']).withMessage('Invalid fuel type'),
  body('location').notEmpty().withMessage('Location is required')
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

    const car = await Car.create(req.body);

    res.status(201).json({
      success: true,
      message: 'Car created successfully',
      data: car
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
});

module.exports = router;
