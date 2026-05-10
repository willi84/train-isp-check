function getClientIp(req) {
  const forwarded = req.headers["x-forwarded-for"];
  if (forwarded) {
    return forwarded.split(",")[0].trim();
  }

  const realIp = req.headers["x-real-ip"];
  if (realIp) {
    return realIp.trim();
  }

  return "";
}

function normalizeIp(ip) {
  if (!ip) return "";
  if (ip.startsWith("::ffff:")) {
    return ip.slice(7);
  }
  return ip;
}

function isLikelyTrainIsp(value) {
  return String(value || "").toLowerCase().includes("icomera");
}

function getRequestOrigin(req) {
  return req.headers.origin || "";
}

function isLocalhostOrigin(originUrl) {
  return originUrl.hostname === "localhost" || originUrl.hostname === "127.0.0.1";
}

function isVercelOrigin(originUrl) {
  return originUrl.hostname.endsWith(".vercel.app");
}

function getConfiguredOrigins() {
  return [
    process.env.CORS_ALLOWED_ORIGINS,
    process.env.APP_ORIGIN,
    "https://pendler-alarm.de",
    "https://pendler-alarm-de.vercel.app"
  ]
    .filter(Boolean)
    .flatMap((value) => value.split(","))
    .map((value) => value.trim())
    .filter(Boolean);
}

function isConfiguredOrigin(origin, configuredOrigins) {
  return configuredOrigins.includes(origin);
}

function getAllowedOrigin(req) {
  const origin = getRequestOrigin(req);
  if (!origin) return "";

  try {
    const originUrl = new URL(origin);
    const configuredOrigins = getConfiguredOrigins();

    if (isLocalhostOrigin(originUrl)) return origin;
    if (isVercelOrigin(originUrl)) return origin;
    if (isConfiguredOrigin(origin, configuredOrigins)) return origin;

    return "";
  } catch {
    return "";
  }
}

function setCorsHeaders(req, res) {
  const allowedOrigin = getAllowedOrigin(req);

  if (allowedOrigin) {
    res.setHeader("Access-Control-Allow-Origin", allowedOrigin);
    res.setHeader("Vary", "Origin");
  }

  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Access-Control-Max-Age", "86400");

  return allowedOrigin;
}

function respondJson(req, res, statusCode, payload) {
  setCorsHeaders(req, res);
  return res.status(statusCode).json(payload);
}

export default async function handler(req, res) {
  try {
    const allowedOrigin = setCorsHeaders(req, res);

    if (req.method === "OPTIONS") {
      return res.status(200).end();
    }

    if (getRequestOrigin(req) && !allowedOrigin) {
      return res.status(403).json({
        error: "Origin not allowed"
      });
    }

    const ip = normalizeIp(getClientIp(req));

    if (!ip) {
      return respondJson(req, res, 400, {
        error: "Could not determine client IP"
      });
    }

    const response = await fetch(`https://ipinfo.io/${encodeURIComponent(ip)}/json`);
    if (!response.ok) {
      return respondJson(req, res, 502, {
        error: `IP lookup failed with status ${response.status}`
      });
    }

    const data = await response.json();
    const isp = data.org || data.company?.name || "";

    return respondJson(req, res, 200, {
      ip,
      isp,
      isTrainLikely: isLikelyTrainIsp(isp),
      raw: data
    });
  } catch (error) {
    return respondJson(req, res, 500, {
      error: error instanceof Error ? error.message : "Unknown error"
    });
  }
}
