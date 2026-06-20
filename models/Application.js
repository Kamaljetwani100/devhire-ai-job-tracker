const mongoose = require('mongoose');

const applicationSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    company: {
      type: String,
      required: [true, 'Company name is required'],
      trim: true,
      maxlength: [150, 'Company name cannot exceed 150 characters'],
    },
    role: {
      type: String,
      required: [true, 'Role is required'],
      trim: true,
      maxlength: [150, 'Role cannot exceed 150 characters'],
    },
    status: {
      type: String,
      enum: {
        values: ['Applied', 'Screening', 'Interview', 'Offer', 'Rejected', 'Withdrawn'],
        message: '{VALUE} is not a valid status',
      },
      default: 'Applied',
    },
    dateApplied: {
      type: Date,
      default: Date.now,
    },
    salary: {
      type: String,
      trim: true,
      maxlength: [100, 'Salary field cannot exceed 100 characters'],
      default: '',
    },
    location: {
      type: String,
      trim: true,
      maxlength: [150, 'Location cannot exceed 150 characters'],
      default: '',
    },
    url: {
      type: String,
      trim: true,
      maxlength: [500, 'URL cannot exceed 500 characters'],
      default: '',
    },
    notes: {
      type: String,
      trim: true,
      maxlength: [2000, 'Notes cannot exceed 2000 characters'],
      default: '',
    },
  },
  {
    timestamps: true,
  }
);

// Compound index for efficient per-user queries
applicationSchema.index({ user: 1, createdAt: -1 });

module.exports = mongoose.model('Application', applicationSchema);
