const express = require('express');
const cors = require('cors');
const path = require('path');
const { securityHeaders, limiter, xss, hpp } = require('./middleware/security');
const corsOptions = require('./config/cors');
const sequelize = require('./config/database');

// Import routes (to be created)
const authRoutes = require('./routes/auth');
// const taskRoutes = require('./routes/tasks');

const app = express();

// Middleware
app.use(securityHeaders);
app.use(cors(corsOptions));
app.use(limiter);
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Security: Data Sanitization
app.use(xss()); // Data sanitization against XSS
app.use(hpp()); // Prevent parameter pollution

// Database Sync
sequelize.sync({ alter: true }).then(() => {
  console.log('Database synced');
}).catch(err => {
  console.error('Database sync error:', err);
});

// Routes
app.use('/api/auth', authRoutes);
// app.use('/api/tasks', taskRoutes);

// Health Check
app.get('/api/health', (req, res) => {
  res.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

module.exports = app;
