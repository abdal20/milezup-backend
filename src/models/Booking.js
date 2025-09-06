const mongoose = require('mongoose');

const bookingSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  car: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Car',
    required: true
  },
  startDate: {
    type: Date,
    required: [true, 'Start date is required']
  },
  endDate: {
    type: Date,
    required: [true, 'End date is required']
  },
  totalDays: {
    type: Number,
    required: true
  },
  totalAmount: {
    type: Number,
    required: true,
    min: [0, 'Total amount cannot be negative']
  },
  status: {
    type: String,
    enum: ['pending', 'confirmed', 'active', 'completed', 'cancelled'],
    default: 'pending'
  },
  paymentStatus: {
    type: String,
    enum: ['pending', 'paid', 'failed', 'refunded'],
    default: 'pending'
  },
  paymentMethod: {
    type: String,
    enum: ['card', 'cash', 'bank_transfer']
  },
  stripePaymentIntentId: String,
  pickupLocation: {
    type: String,
    required: [true, 'Pickup location is required']
  },
  returnLocation: {
    type: String,
    required: [true, 'Return location is required']
  },
  specialRequests: String,
  isGuestBooking: {
    type: Boolean,
    default: false
  },
  guestInfo: {
    name: String,
    email: String,
    phone: String
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Validate date range
bookingSchema.pre('validate', function(next) {
  if (this.startDate >= this.endDate) {
    next(new Error('End date must be after start date'));
  }
  
  // Calculate total days
  const timeDiff = this.endDate.getTime() - this.startDate.getTime();
  this.totalDays = Math.ceil(timeDiff / (1000 * 3600 * 24));
  
  next();
});

// Index for queries
bookingSchema.index({ user: 1, createdAt: -1 });
bookingSchema.index({ car: 1, startDate: 1, endDate: 1 });
bookingSchema.index({ status: 1, createdAt: -1 });

module.exports = mongoose.model('Booking', bookingSchema);