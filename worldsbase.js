const axios = require("axios");

const worldsbaseInstance = axios.create({
  baseURL: process.env.API_BASE_URL,
  headers: {
    "Content-Type": "application/json",
    "x-api-key": process.env.X_API_KEY,
  },
});

module.exports = worldsbaseInstance;
