const SHEET_URL = "https://docs.google.com/spreadsheets/d/1trsSsgYBXYmB_Ab8ghQc3OHkJbx_MXrPigNItLvboP0/gviz/tq?tqx=out:json&sheet=WIFI";

const { normalizeText } = require("./../utils/utils");

/**
 * 🎯 parse the Google Visualization JSONP response
 * @param {string} text the JSONP response text
 * @returns {object} the parsed JSON object
 */
const parseGoogleVisualizationJson = (text) => {
  const match = String(text || "").match(/google\.visualization\.Query\.setResponse\((.*)\);?\s*$/s);
  if (!match) {
    throw new Error("Could not parse Google Sheets response");
  }

  return JSON.parse(match[1]);
}

/**
 * 🎯 get the value of a cell, handling null and undefined values
 * @param {*} cell the cell object
 * @returns {string} the cell value
 */
const getCellValue = (cell) => {
  return cell?.v ?? "";
}

const rowToValues = (row) => {
  return (row?.c || []).map((cell) => String(getCellValue(cell) || "").trim());
}

const detectColumnsFromHeader = (rows) => {
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

  return { keyColumn, contextColumn };
}



const extractTrainIspMatchers = (sheetJson) => {
  const rows = sheetJson?.table?.rows || [];
  const { keyColumn, contextColumn } = detectColumnsFromHeader(rows);

  if (keyColumn === -1 || contextColumn === -1) {
    throw new Error("Could not detect KEY and Kontext columns from sheet header");
  }

  const matchers = [];

  for (const row of rows.slice(1)) {
    const values = rowToValues(row);
    const key = values[keyColumn] || "";
    const context = values[contextColumn] || "";

    if (!key || !context) {
        continue;
    }
    

    matchers.push({
      key: normalizeText(key),
      context
    });
  }

  return { matchers, keyColumn, contextColumn };
}
const getSheetData = async (id, tab) => {
    const GOOGLE_SHEET_URL = SHEET_URL.replace("{id}", id).replace("{tab}", tab);
    const response = await fetch(GOOGLE_SHEET_URL);

    if (!response.ok) {
        throw new Error(`Google Sheets lookup failed with status ${response.status}`);
    }

    const text = await response.text();
    return parseGoogleVisualizationJson(text);
}

exports.parseGoogleVisualizationJson = parseGoogleVisualizationJson;
exports.extractTrainIspMatchers = extractTrainIspMatchers;
exports.getCellValue = getCellValue;
exports.rowToValues = rowToValues;
exports.detectColumnsFromHeader = detectColumnsFromHeader;
exports.getSheetData = getSheetData;