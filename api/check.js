const GOOGLE_SHEET_URL = "https://docs.google.com/spreadsheets/d/1trsSsgYBXYmB_Ab8ghQc3OHkJbx_MXrPigNItLvboP0/gviz/tq?tqx=out:json&sheet=WIFI";
const TRAIN_TERMS = [
  "zug",
  "train",
  "rail",
  "bahn",
  "onboard",
  "on board",
  "wifi"
];

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
  return String(value || "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

function rowToValues(row) {
  return (row?.c || []).map((cell) => String(getCellValue(cell) || "").trim());
}

function scoreColumn(values, columnIndex) {
  let score = 0;

  for (const value of values) {
    const normalized = normalizeText(value[columnIndex]);
    if (!normalized) continue;

    if (columnIndex === 0) {
      if (/^[a-z0-9._ -]+$/i.test(value[columnIndex])) score += 2;
      if (normalized.length <= 40) score += 1;
    }

    if (TRAIN_TERMS.some((term) => normalized.includes(term))) {
      score += 4;
    }
  }

  return score;
}

function detectColumns(rows) {
  const values = rows.map(rowToValues).filter((row) => row.some(Boolean));
  const maxColumns = values.reduce((max, row) => Math.max(max, row.length), 0);

  if (!maxColumns) {
    return { keyColumn: 0, contextColumn: 2 };
  }

  let keyColumn = 0;
  let keyScore = -1;
  let contextColumn = 0;
  let contextScore = -1;

  for (let columnIndex = 0; columnIndex < maxColumns; columnIndex += 1) {
    const score = scoreColumn(values, columnIndex);

    if (score > keyScore) {
      keyScore = score;
      keyColumn = columnIndex;
    }
  }

  for (let columnIndex = 0; columnIndex < maxColumns; columnIndex += 1) {
    if (columnIndex === keyColumn) continue;
    const score = scoreColumn(values, columnIndex);

    if (score > contextScore) {
      contextScore = score;
      contextColumn = columnIndex;
    }
  }

  return { keyColumn, contextColumn };
}

function isRelevantTrainContext(context) {
  const normalized = normalizeText(context);
  return TRAIN_TERMS.some((term) => normalized.includes(term));
}

function extractTrainIspMatchers(sheetJson) {
  const rows = sheetJson?.table?.rows || [];
  const { keyColumn, contextColumn } = detectColumns(rows);
  const matchers = [];

  for (const row of rows) {
    const values = rowToValues(row);
    const key = values[keyColumn] || "";
    const context = values[contextColumn] || "";

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

  return { matchers, keyColumn, contextColumn };
}

async function getTrainIspMatchers() {
  const response = await fetch(GOOGLE_SHEET_URL);

  if (!response.ok) {
    throw new Error(`Google Sheets lookup failed with status ${response.status}`);
  }

  const text = await response.text();
  const sheetJson = parseGoogleVisualizationJson(text);
  return extractTrainIspMatchers(sheetJson);
}

function isLikelyTrainIsp(value, matchers) {
  const normalizedValue = normalizeText(value);
  return matchers.some(({ key }) => key && normalizedValue.includes(key));
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

    const [ipResponse, matcherResult] = await Promise.all([
      fetch(`https://ipinfo.io/${encodeURIComponent(ip)}/json`),
      getTrainIspMatchers()
    ]);

    if (!ipResponse.ok) {
      return respondJson(req, res, 502, {
        error: `IP lookup failed with status ${ipResponse.status}`
      });
    }

    const data = await ipResponse.json();
    const isp = data.org || data.company?.name || "";
    const normalizedIsp = normalizeText(isp);
    const matchedEntry = matcherResult.matchers.find(({ key }) => key && normalizedIsp.includes(key));

    return respondJson(req, res, 200, {
      ip,
      isp,
      isTrainLikely: isLikelyTrainIsp(isp, matcherResult.matchers),
      matchedKey: matchedEntry?.key || "",
      matchContext: matchedEntry?.context || "",
      detectedColumns: {
        keyColumn: matcherResult.keyColumn,
        contextColumn: matcherResult.contextColumn
      },
      raw: data
    });
  } catch (error) {
    return respondJson(req, res, 500, {
      error: error instanceof Error ? error.message : "Unknown error"
    });
  }
}
