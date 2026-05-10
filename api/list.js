function parseGoogleVisualizationJson(text) {
  const match = String(text || "").match(/google\.visualization\.Query\.setResponse\((.*)\);?\s*$/s);
  if (!match) {
    throw new Error("Could not parse Google Sheets response");
  }

  return JSON.parse(match[1]);
}

function getCellValue(cell) {
  return cell?.v ?? "";
}

function normalizeText(value) {
  return String(value || "").trim().toLowerCase();
}

function isRelevantTrainContext(context) {
  const normalized = normalizeText(context);
  return normalized.includes("zug") || normalized.includes("train") || normalized.includes("icomera");
}

function extractTrainIspMatchers(sheetJson) {
  const rows = sheetJson?.table?.rows || [];
  const matchers = [];

  for (const row of rows) {
    const cells = row?.c || [];
    const key = String(getCellValue(cells[0]) || "").trim();
    const context = String(getCellValue(cells[2]) || "").trim();

    if (!key || !context) {
      continue;
    }

    if (!isRelevantTrainContext(context)) {
      continue;
    }

    matchers.push({
      key: normalizeText(key),
      context
    });
  }

  return matchers;
}

async function getTrainIspMatchers() {
  const response = await fetch("https://docs.google.com/spreadsheets/d/1trsSsgYBXYmB_Ab8ghQc3OHkJbx_MXrPigNItLvboP0/gviz/tq?tqx=out:json&sheet=WIFI");

  if (!response.ok) {
    throw new Error(`Google Sheets lookup failed with status ${response.status}`);
  }

  const text = await response.text();
  const sheetJson = parseGoogleVisualizationJson(text);
  return extractTrainIspMatchers(sheetJson);
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

    const matchers = await getTrainIspMatchers();

    return respondJson(req, res, 200, {
      count: matchers.length,
      items: matchers.reduce((accumulator, matcher) => {
        accumulator[matcher.key] = matcher.context;
        return accumulator;
      }, {})
    });
  } catch (error) {
    return respondJson(req, res, 500, {
      error: error instanceof Error ? error.message : "Unknown error"
    });
  }
}
