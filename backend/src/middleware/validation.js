const Joi = require('joi');
const xss = require('xss-clean');

// Sanitize input middleware
const sanitize = (req, res, next) => {
  // xss-clean middleware is already applied globally in app.js, 
  // but we can add custom sanitization here if needed.
  next();
};

// Validation Helper
const validate = (schema) => (req, res, next) => {
  const { error } = schema.validate(req.body, { abortEarly: false });
  if (error) {
    const errorMessage = error.details.map((detail) => detail.message).join(', ');
    return res.status(400).json({ error: errorMessage });
  }
  next();
};

// Schemas
const schemas = {
  register: Joi.object({
    firstName: Joi.string().alphanum().min(2).max(30).required(),
    lastName: Joi.string().alphanum().min(2).max(30).required(),
    email: Joi.string().email().required(),
    password: Joi.string().min(6).required(),
    confirmPassword: Joi.string().valid(Joi.ref('password')).strip() // Optional, strip if present
  }),
  login: Joi.object({
    email: Joi.string().email().required(),
    password: Joi.string().required()
  }),
  task: Joi.object({
    title: Joi.string().min(1).max(255).required(),
    description: Joi.string().allow('', null),
    dueDate: Joi.date().allow(null),
    priority: Joi.string().valid('low', 'medium', 'high'),
    category: Joi.string().alphanum().max(50)
  })
};

module.exports = {
  validate,
  schemas,
  sanitize
};
