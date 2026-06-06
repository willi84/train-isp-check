import { getSheetData, extractTrainIspMatchers } from "./../src/google/google.js";
import { getClientIp, getRequestOrigin, normalizeIp, setCorsHeaders } from "./../src/http/http.js";
import { normalizeText } from "./../src/utils/utils.js";
import { SHEET_ID, SHEET_TAB } from "./check.config.js";

const getTrainIspMatchers = async () => {
  const sheetJson = await getSheetData(SHEET_ID, SHEET_TAB);
  return extractTrainIspMatchers(sheetJson);
};

const isLikelyTrainIsp = (value, matchers) => {
  const normalizedValue = normalizeText(value);
  return matchers.some(({ key }) => key && normalizedValue.includes(key));
};

const respondJson = (req, res, statusCode, payload) => {
  setCorsHeaders(req, res);
  return res.status(statusCode).json(payload);
};

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
