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

function getTargetUrl(req) {
  const value = req.query?.url;
  const url = Array.isArray(value) ? value[0] : value;
  return String(url || "").trim();
}

function isPrivateHostname(hostname) {
  const normalized = String(hostname || "").toLowerCase();

  if (!normalized) return true;
  if (normalized === "localhost") return true;
  if (normalized.endsWith(".localhost")) return true;
  if (normalized === "0.0.0.0") return true;
  if (normalized === "::1") return true;
  if (normalized.endsWith(".local")) return true;

  if (/^127\./.test(normalized)) return true;
  if (/^10\./.test(normalized)) return true;
  if (/^192\.168\./.test(normalized)) return true;
  if (/^169\.254\./.test(normalized)) return true;
  if (/^172\.(1[6-9]|2\d|3[0-1])\./.test(normalized)) return true;

  return false;
}

function isLikelyIcs(text) {
  const normalized = String(text || "").trim();
  if (!normalized) return false;

  return normalized.includes("BEGIN:VCALENDAR") && normalized.includes("END:VCALENDAR");
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

    if (req.method !== "GET") {
      return respondJson(req, res, 405, {
        error: "Method not allowed"
      });
    }

    const targetUrl = getTargetUrl(req);

    if (!targetUrl) {
      return respondJson(req, res, 400, {
        error: "Missing url query parameter"
      });
    }

    let parsedUrl;
    try {
      parsedUrl = new URL(targetUrl);
    } catch {
      return respondJson(req, res, 400, {
        error: "Invalid url"
      });
    }

    if (parsedUrl.protocol !== "https:" && parsedUrl.protocol !== "http:") {
      return respondJson(req, res, 400, {
        error: "Only http and https URLs are allowed"
      });
    }

    if (isPrivateHostname(parsedUrl.hostname)) {
      return respondJson(req, res, 400, {
        error: "Target host is not allowed"
      });
    }

    const upstreamResponse = await fetch(parsedUrl.toString(), {
      redirect: "follow",
      headers: {
        Accept: "text/calendar, text/plain;q=0.9, */*;q=0.1",
        "User-Agent": "train-isp-check-ics-proxy/1.0"
      }
    });

    if (!upstreamResponse.ok) {
      return respondJson(req, res, 502, {
        error: `Upstream request failed with status ${upstreamResponse.status}`
      });
    }

    const contentType = upstreamResponse.headers.get("content-type") || "";
    const contentDisposition = upstreamResponse.headers.get("content-disposition") || "";
    const text = await upstreamResponse.text();
    const looksLikeIcs = isLikelyIcs(text);
    const urlSuggestsIcs = parsedUrl.pathname.toLowerCase().endsWith(".ics");
    const contentTypeSuggestsIcs = contentType.toLowerCase().includes("text/calendar");
    const dispositionSuggestsIcs = contentDisposition.toLowerCase().includes(".ics");

    if (!looksLikeIcs || (!urlSuggestsIcs && !contentTypeSuggestsIcs && !dispositionSuggestsIcs)) {
      return respondJson(req, res, 415, {
        error: "Upstream response is not an ICS calendar"
      });
    }

    res.setHeader("Content-Type", "text/calendar; charset=utf-8");
    res.setHeader("Content-Disposition", 'inline; filename="calendar.ics"');
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Cache-Control", "public, max-age=300");

    return res.status(200).send(text);
  } catch (error) {
    return respondJson(req, res, 500, {
      error: error instanceof Error ? error.message : "Unknown error"
    });
  }
}
