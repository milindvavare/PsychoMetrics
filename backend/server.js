const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

const db = require('./config/database');
const logger = require('./utils/logger');

// Import routes
const authRoutes = require('./routes/auth');
const companyRoutes = require('./routes/companies');
const testRoutes = require('./routes/tests');
const questionRoutes = require('./routes/questions');
const attemptRoutes = require('./routes/attempts');
const scoreRoutes = require('./routes/scores');
const radarRoutes = require('./routes/radar');
const aiRoutes = require('./routes/ai');
const benchmarkRoutes = require('./routes/benchmark');
const shortlistRoutes = require('./routes/shortlist');
const reportRoutes = require('./routes/reports');
const candidateRoutes = require('./routes/candidates');
const categoryRoutes = require('./routes/categories');
const candidateAuthRoutes = require('./routes/candidateAuth');
const testAssignmentRoutes = require('./routes/testAssignments');
const kraRoutes = require('./routes/kras');
const kpiRoutes = require('./routes/kpis');
const userRoutes = require('./routes/users');

const app = express();
const PORT = process.env.PORT || 5000;

// Security middleware
app.use(helmet());
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true
}));

// Rate limiting - General API routes (more lenient)
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 500, // limit each IP to 500 requests per windowMs (increased from 100)
  message: {
    success: false,
    message: 'Too many requests from this IP, please try again later.'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Body parser
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Request logging
app.use((req, res, next) => {
  logger.info(`${req.method} ${req.path} - IP: ${req.ip}`);
  next();
});

// Health check (no rate limiting)
app.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Apply general rate limiter to all API routes (login routes have their own limiter in route files)
app.use('/api/', generalLimiter);

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/companies', companyRoutes);
app.use('/api/tests', testRoutes);
app.use('/api/questions', questionRoutes);
app.use('/api/attempts', attemptRoutes);
app.use('/api/scores', scoreRoutes);
app.use('/api/radar', radarRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/benchmark', benchmarkRoutes);
app.use('/api/shortlist', shortlistRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/candidates', candidateRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/candidate-auth', candidateAuthRoutes);
app.use('/api/test-assignments', testAssignmentRoutes);
app.use('/api/kras', kraRoutes);
app.use('/api/kpis', kpiRoutes);
app.use('/api/users', userRoutes);

// Error handling middleware
app.use((err, req, res, next) => {
  logger.error(`Error: ${err.message}`, { stack: err.stack });
  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Internal server error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ success: false, message: 'Route not found' });
});

// Initialize database and start server
db.initialize()
  .then(() => {
    app.listen(PORT, () => {
      logger.info(`Server running on port ${PORT}`);
      logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
    });
  })
  .catch((error) => {
    logger.error('Failed to initialize database:', error);
    process.exit(1);
  });

module.exports = app;

