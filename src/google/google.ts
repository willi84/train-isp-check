import { normalizeText } from "./../utils/utils.js";

const SHEET_URL = "https://docs.google.com/spreadsheets/d/{id}/gviz/tq?tqx=out:json&sheet={tab}";

/**
 * 🎯 parse the Google Visualization JSONP response
 * @param {string} text the JSONP response text
 * @returns {object} the parsed JSON object
 */
export const parseGoogleVisualizationJson = (text) => {
  const match = String(text || "").match(/google\.visualization\.Query\.setResponse\((.*)\);?\s*$/s);
  if (!match) {
    throw new Error("Could not parse Google Sheets response");
  }

  return JSON.parse(match[1]);
};

/**
 * 🎯 get the value of a cell, handling null and undefined values
 * @param {*} cell the cell object
 * @returns {string} the cell value
 */
export const getCellValue = (cell) => {
  return cell?.v ?? "";
};

export const rowToValues = (row) => {
  return (row?.c || []).map((cell) => String(getCellValue(cell) || "").trim());
};

export const detectColumnsFromHeader = (rows) => {
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
};

export const extractTrainIspMatchers = (sheetJson) => {
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
};

export const getSheetData = async (id, tab) => {
  const googleSheetUrl = SHEET_URL.replace("{id}", id).replace("{tab}", tab);
  const response = await fetch(googleSheetUrl);

  if (!response.ok) {
    throw new Error(`Google Sheets lookup failed with status ${response.status}`);
  }

  const text = await response.text();
  return parseGoogleVisualizationJson(text);
};
