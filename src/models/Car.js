const mongoose = require('mongoose');

const carSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Car name is required'],
    trim: true
  },
  brand: {
    type: String,
    required: [true, 'Brand is required'],
    trim: true
  },
  model: {
    type: String,
    required: [true, 'Model is required'],
    trim: true
  },
  year: {
    type: Number,
    required: [true, 'Year is required'],
    min: [1900, 'Invalid year'],
    max: [new Date().getFullYear() + 1, 'Invalid year']
  },
  category: {
    type: String,
    required: [true, 'Category is required'],
    enum: ['economy', 'compact', 'midsize', 'fullsize', 'premium', 'luxury', 'suv', 'van', 'sports', 'electric']
  },
  pricePerDay: {
    type: Number,
    required: [true, 'Price per day is required'],
    min: [0, 'Price cannot be negative']
  },
  seats: {
    type: Number,
    required: [true, 'Number of seats is required'],
    min: [1, 'Must have at least 1 seat'],
    max: [15, 'Cannot exceed 15 seats']
  },
  transmission: {
    type: String,
    required: [true, 'Transmission type is required'],
    enum: ['manual', 'automatic', 'cvt']
  },
  fuelType: {
    type: String,
    required: [true, 'Fuel type is required'],
    enum: ['gasoline', 'diesel', 'electric', 'hybrid']
  },
  mileage: {
    type: Number,
    required: [true, 'Mileage is required'],
    min: [0, 'Mileage cannot be negative']
  },
  features: [String],
  images: [String],
  description: {
    type: String,
    maxlength: [500, 'Description cannot exceed 500 characters']
  },
  isAvailable: {
    type: Boolean,
    default: true
  },
  location: {
    type: String,
    required: [true, 'Location is required']
  },
  rating: {
    average: { type: Number, default: 0, min: 0, max: 5 },
    count: { type: Number, default: 0 }
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Index for search functionality
carSchema.index({ name: 'text', brand: 'text', model: 'text', category: 'text' });
carSchema.index({ category: 1, pricePerDay: 1 });
carSchema.index({ location: 1, isAvailable: 1 });

module.exports = mongoose.model('Car', carSchema);
