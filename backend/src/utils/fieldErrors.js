// Turns a Joi error into the `errors` map: { "field.path": messageKey }.
// Schemas set message KEYS (see FIELD_MESSAGES in constants/messages.js), e.g.
//   Joi.string().email().required().messages({ "any.required": "emailRequired", "string.email": "emailInvalid" })
// The error handler translates the keys per request. Only the first message
// per field is kept.
const fieldErrorsFromJoi = (joiError) => {
  const errors = {};
  (joiError?.details || []).forEach(({ path, message }) => {
    const field = path.join(".");
    if (!(field in errors)) errors[field] = message;
  });
  return errors;
};

module.exports = { fieldErrorsFromJoi };
