require('dotenv').config();
console.log("MONGO URI =", process.env.MONGO_URI);
const express = require('express');
const cors = require('cors');
const connectDB = require('./configs/db');

const authRoutes = require('./routes/auth');
const applicationRoutes = require('./routes/applications');

/* ========== Connect Database ========== */
connectDB();

/* ========== App Init ========== */
const app = express();

/* ========== Middleware ========== */
app.use(cors({
  origin: process.env.CLIENT_ORIGIN || '*',
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: true, limit: '10kb' }));

/* ========== Routes ========== */
app.use('/api/auth', authRoutes);
app.use('/api/applications', applicationRoutes);

/* ========== Health Check ========== */
app.get('/api/health', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'DevHire AI API is running.',
    env: process.env.NODE_ENV || 'development',
    timestamp: new Date().toISOString(),
  });
});

/* ========== 404 Handler ========== */
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: `Route ${req.method} ${req.originalUrl} not found.`,
  });
});

/* ========== Global Error Handler ========== */
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);

  if (err.name === 'ValidationError') {
    const messages = Object.values(err.errors).map((e) => e.message);
    return res.status(400).json({ success: false, message: messages.join(', ') });
  }

  if (err.code === 11000) {
    const field = Object.keys(err.keyValue)[0];
    return res.status(409).json({
      success: false,
      message: `${field.charAt(0).toUpperCase() + field.slice(1)} already in use.`,
    });
  }

  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Internal server error.',
  });
});

/* ========== Start Server ========== */
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`DevHire AI API running on port ${PORT} [${process.env.NODE_ENV || 'development'}]`);
});

module.exports = app;
