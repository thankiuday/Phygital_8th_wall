'use strict';

/**
 * apiResponse — standardised API response helpers.
 *
 * All controller responses should use these to keep the API shape consistent.
 */

const success = (res, data = {}, message = 'Success', statusCode = 200) => {
  return res.status(statusCode).json({
    success: true,
    message,
    data,
  });
};

const created = (res, data = {}, message = 'Created') => {
  return success(res, data, message, 201);
};

const error = (res, message = 'Error', statusCode = 400, errors = null) => {
  return res.status(statusCode).json({
    success: false,
    message,
    ...(errors && { errors }),
  });
};

module.exports = { success, created, error };
