import { check } from 'express-validator';

/*
* Validation rules:
* .exists() - checks if the parameter exists
* .isNumeric() - checks if the parameter is a number
* .isAlpha() - checks if the parameter contains only alphabetic characters
* .isLength() - checks if the parameter has a specific length
* .custom() - checks if the parameter meets a specific condition
* .isArray() - checks if the parameter is an array
* .matches() - checks if the parameter matches a specific pattern
* .withMessage() - sets the error message for the validation rule
*/

// Validation rules for the guild parameter
const guildValidation = [
    check('guild')
    .exists().withMessage('Guild parameter is required')
    .isNumeric().withMessage('Guild must be numeric')
    .isLength({ min: 17, max: 19 }).withMessage('Guild must be a valid Snowflake ID'),
];

// Validation rules for the channel parameter
const channelValidation = [
  check('channel')
  .exists().withMessage('Channel parameter is required')
  .isNumeric().withMessage('Channel must be numeric')
  .isLength({ min: 17, max: 19 }).withMessage('Channel must be a valid Snowflake ID'),
];

// Validation rules for the integration parameter
const integrationValidation = [
  check('integration')
  .exists().withMessage('Integration parameter is required')
  .custom(value => ['trello', 'github', 'googlecalendar'].includes(value.toLowerCase()))
  .withMessage('Integration must be either "Trello", "GitHub" or "Google Calendar"')
];

// Validation rules for the serviceType parameter
const serviceTypeValidation = [
  check('serviceType')
  .exists().withMessage('Service type parameter is required')
  .custom(value => ['commands', 'notifications'].includes(value.toLowerCase()))
  .withMessage('Service type must be either "commands" or "notifications"'),
];

// Validation rules for tokens
const tokensValidation = [
  check('tokens')
  .exists().withMessage('Tokens parameter is required')
  .isArray().withMessage('Tokens must be an array')
  .isLength({ min: 1 }).withMessage('Tokens must have at least one element'),

  check('tokens.*.name')
  .exists().withMessage('Name field is required')
  .matches(/^[\sa-zA-Z]+$/).withMessage('Name field must contain only alphabetic characters and spaces'),
];

// Validation rules for services array
const servicesValidation = [
  check('services')
  .exists().withMessage('Services parameter is required')
  .isArray().withMessage('Services must be an array')
  .isLength({ min: 1 }).withMessage('Services must have at least one element'),
  
  // Check if each service is a string with alphabetic characters and spaces
  check('services.*')
  .exists().withMessage('Service is required')
  .matches(/^[A-Za-z\s]+$/).withMessage('Service must contain only alphabetic characters and spaces'),
];

// Validation rules for single service
const serviceValidation = [
  check('service')
  .exists().withMessage('Service parameter is required')
  .matches(/^[A-Za-z\s]+$/).withMessage('Service must contain only alphabetic characters and spaces'),
];

export { guildValidation, channelValidation, integrationValidation, serviceTypeValidation, tokensValidation, servicesValidation, serviceValidation, };