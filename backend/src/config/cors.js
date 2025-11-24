const allowedOrigins = [
  'https://timeswap.zykro.dev',
  'https://zykro.dev' // Keep legacy support if needed, or remove if strictly timeswap
];

// Allow localhost in development
if (process.env.NODE_ENV !== 'production') {
  allowedOrigins.push('http://localhost:4567');
  allowedOrigins.push('http://127.0.0.1:4567');
  allowedOrigins.push('http://localhost:3000'); // Common frontend dev port
  allowedOrigins.push('http://127.0.0.1:5500'); // VS Code Live Server
}

const corsOptions = {
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    
    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
};

module.exports = corsOptions;
