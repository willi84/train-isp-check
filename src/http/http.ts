import { ALLOWED_ORIGINS } from "./http.config.js";

/**
 * 🎯 get the client IP address from the request headers
 * @param {object} req the request object
 * @returns {string} the client IP address
 */
export const getClientIp = (req) => {
  const forwarded = req.headers["x-forwarded-for"];
  if (forwarded) {
    return forwarded.split(",")[0].trim();
  }

  const realIp = req.headers["x-real-ip"];
  if (realIp) {
    return realIp.trim();
  }

  return "";
};

/**
 * 🎯 get the origin of the request
 * @param {*} req the request object
 * @returns {string} the origin of the request
 */
export const getRequestOrigin = (req) => {
  return req.headers.origin || "";
};

/**
 * 🎯 get the configured origins from the allowed origins
 * @param {string[]} allowedOrigins the allowed origins
 * @returns {string[]} the configured origins
 */
export const getConfiguredOrigins = (allowedOrigins) => {
  return allowedOrigins
    .filter(Boolean)
    .flatMap((value) => value.split(","))
    .map((value) => value.trim())
    .filter(Boolean);
};

/**
 * 🎯 check if the origin is localhost
 * @param {URL} originUrl the origin URL
 * @returns {boolean} true if the origin is localhost, false otherwise
 */
export const isLocalhostOrigin = (originUrl) => {
  return originUrl.hostname === "localhost" || originUrl.hostname === "127.0.0.1";
};

/**
 * 🎯 check if the origin is a Vercel deployment
 * @param {URL} originUrl the origin URL
 * @returns {boolean} true if the origin is a Vercel deployment, false otherwise
 */
export const isVercelOrigin = (originUrl) => {
  return originUrl.hostname.endsWith(".vercel.app");
};

/**
 * 🎯 check if the origin is a configured origin
 * @param {string} origin the origin to check
 * @param {string[]} configuredOrigins the configured origins
 * @returns {boolean} true if the origin is a configured origin, false otherwise
 */
export const isConfiguredOrigin = (origin, configuredOrigins) => {
  return configuredOrigins.includes(origin);
};

/**
 * 🎯 determine the allowed origin for the request and set CORS headers accordingly
 * @param {*} req the request object
 * @returns {string} the allowed origin
 */
const getAllowedOrigin = (req) => {
  const origin = getRequestOrigin(req);
  if (!origin) return "";

  try {
    const originUrl = new URL(origin);
    const configuredOrigins = getConfiguredOrigins(ALLOWED_ORIGINS);

    if (isLocalhostOrigin(originUrl)) return origin;
    if (isVercelOrigin(originUrl)) return origin;
    if (isConfiguredOrigin(origin, configuredOrigins)) return origin;

    return "";
  } catch {
    return "";
  }
};

export const setCorsHeaders = (req, res) => {
  const allowedOrigin = getAllowedOrigin(req);

  if (allowedOrigin) {
    res.setHeader("Access-Control-Allow-Origin", allowedOrigin);
    res.setHeader("Vary", "Origin");
  }

  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Access-Control-Max-Age", "86400");

  return allowedOrigin;
};

/**
 * 🎯 normalize the IP address
 * @param {string} ip the IP address
 * @returns {string} the normalized IP address
 */
export const normalizeIp = (ip) => {
  if (!ip) return "";
  if (ip.startsWith("::ffff:")) {
    return ip.slice(7);
  }
  return ip;
};
