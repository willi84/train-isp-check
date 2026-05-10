const GOOGLE_SHEET_URL = "https://docs.google.com/spreadsheets/d/1trsSsgYBXYmB_Ab8ghQc3OHkJbx_MXrPigNItLvboP0/gviz/tq?tqx=out:json&sheet=WIFI";

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

function detectColumnsFromHeader(rows) {
  const firstRow = rows[0];
  const values = rowToValues(firstRow);

  let keyColumn = -1;
  let contextColumn = -1;

  for (let index = 0; index < values.length; index += 1) {
    const normalized = normalizeText(values[index]);

    if (normalized === "key") {
      keyColumn = index;
    }

    if (normalized === "kontext") {
      contextColumn = index;
    }
  }

  return { keyColumn, contextColumn, headers: values };
}

function extractSheetItems(sheetJson) {
  const rows = sheetJson?.table?.rows || [];
  const { keyColumn, contextColumn, headers } = detectColumnsFromHeader(rows);

  if (keyColumn === -1 || contextColumn === -1) {
    throw new Error("Could not detect KEY and Kontext columns from sheet header");
  }

  const items = [];

  for (const row of rows.slice(1)) {
    const values = rowToValues(row);
    const key = values[keyColumn] || "";
    const context = values[contextColumn] || "";

    if (!key || !context) {
      continue;
    }

    items.push({
      key,
      context
    });
  }

  return {
    items,
    keyColumn,
    contextColumn,
    headers
  };
}

async function getSheetItems() {
  const response = await fetch(GOOGLE_SHEET_URL);

  if (!response.ok) {
    throw new Error(`Google Sheets lookup failed with status ${response.status}`);
  }

  const text = await response.text();
  const sheetJson = parseGoogleVisualizationJson(text);
  return extractSheetItems(sheetJson);
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

    const result = await getSheetItems();

    return respondJson(req, res, 200, {
      count: result.items.length,
      items: result.items,
      detectedColumns: {
        keyColumn: result.keyColumn,
        contextColumn: result.contextColumn
      },
      headers: result.headers
    });
  } catch (error) {
    return respondJson(req, res, 500, {
      error: error instanceof Error ? error.message : "Unknown error"
    });
  }
}
