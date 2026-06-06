const { detectColumnsFromHeader, parseGoogleVisualizationJson, extractTrainIspMatchers, rowToValues, getCellValue } = require('./google');
const RAW = {
    "version":"0.6",
    "reqId":"0",
    "status":"ok","sig":"1279529074",
    "table":{
        "cols":[
            {"id":"A","label":"","type":"string"},
            {"id":"B","label":"","type":"string"},
            {"id":"C","label":"","type":"string"},
            {"id":"D","label":"","type":"string"},
            {"id":"E","label":"","type":"string"},
            {"id":"F","label":"","type":"string"},
            {"id":"G","label":"","type":"string"},
            {"id":"H","label":"","type":"string"}
        ],
        "rows":[
            {"c":[
                {"v":"icon"},
                {"v":"KEY"},
                {"v":"ISP"},
                {"v":"Kontext"},
                
                {"v":"Spalte 3"},
                {"v":"Spalte 4"},
                {"v":"Spalte 5"},
                {"v":"Spalte 6"}
            ]},
            {"c":[null,{"v":"icomera"},{"v":"AS398830 Icomera US, Inc."},{"v":"DB Fernverkehr"},{"v":"Robert"},null,null,{"v":null}]},
            {"c":[null,{"v":"unwirednetworks"},null,{"v":"RE60 Rheine - Braunschweig "},{"v":"Johannes"},{"v":"https://unwirednetworks.com"},null,{"v":null}]},
            {"c":[null,{"v":"timewarp"},{"v":"AS207203 TIMEWARP IT Consulting GmbH"},{"v":"ODEG"},{"v":"Robert"},null,null,{"v":null}]},
            {"c":[null,{"v":"hotsplots"},{"v":"AS210070 Hotsplots GmbH"},{"v":"RMV"},{"v":"Robert"},null,null,{"v":null}]},{"c":[null,{"v":"TelekomX"},{"v":"Deutsche Telekom AG"},{"v":"TEST"},null,null,null,{"v":null}]},{"c":[null,null,{"v":"AS204445 DB Systel GmbH"},{"v":"wifi@db"},{"v":"Robert"},null,{"v":"DB Bahnhof Mainz"},{"v":null}]},{"c":[null,null,{"v":"AS398830 Icomera US, Inc."},{"v":"RE14 Mainz-Frankfurt"},null,null,null,{"v":null}]},{"c":[null,{"v":"Next Layer"},{"v":"AS1764 Next Layer Telekommunikationsdienstleistungs- und Beratungs GmbH"},{"v":"ÖBB"},{"v":"Robert"},null,null,{"v":null}]},{"c":[null,null,{"v":"AS8412 T-Mobile Austria GmbH"},{"v":"MAV"},null,null,null,{"v":null}]},{"c":[null,{"v":"CD-Telematika"},{"v":"AS25512 CD-Telematika a.s."},{"v":"CD"},null,null,null,{"v":null}]}],"parsedNumHeaders":0}}


const SAMPLE = `/*O_o*/
google.visualization.Query.setResponse(${JSON.stringify(RAW)});`;
describe('parseGoogleVisualizationJson()', () => {
    const FN = parseGoogleVisualizationJson;
    it('should parse valid Google Visualization JSONP response', () => {
        expect(FN(SAMPLE)).toEqual(RAW);
    });
});
describe('getCellValue()', () => {
    const FN = getCellValue;
    it('should return the value of a cell', () => {
        expect(FN({ v: 'test' })).toBe('test');
    });
    it('should return an empty string for null or undefined cells', () => {
        expect(FN(null)).toBe('');
        expect(FN(undefined)).toBe('');
        expect(FN({})).toBe('');
    });
});
describe('rowToValues()', () => {
    const FN = rowToValues;
    it('should convert a row to an array of cell values', () => {
        const ROW = RAW.table.rows[0];
        const EXPECTED = ["icon", "KEY", "ISP", "Kontext", "Spalte 3", "Spalte 4", "Spalte 5", "Spalte 6"];
        expect(FN(ROW)).toEqual(EXPECTED);
    });
});
describe('detectColumnsFromHeader()', () => {
    const FN = detectColumnsFromHeader;
    it('should detect the correct columns for KEY and Kontext', () => {
        const ROWS = RAW.table.rows;
        const EXPECTED = { keyColumn: 1, contextColumn: 3 };
        expect(FN(ROWS)).toEqual(EXPECTED);
    });
});

describe('extractTrainIspMatchers()', () => {
  const FN = extractTrainIspMatchers;
    it('should extract the matching items', () => {
        const EXPECTED = { contextColumn: 3,
  keyColumn: 1,
  matchers: 
   [ { context: 'DB Fernverkehr', key: 'icomera' },
     { context: 'RE60 Rheine - Braunschweig',
       key: 'unwirednetworks' },
     { context: 'ODEG', key: 'timewarp' },
     { context: 'RMV', key: 'hotsplots' },
     { context: 'TEST', key: 'telekomx' }, 
     { context: 'ÖBB', key: 'next layer' }, 
     { context: 'CD', key: 'cd-telematika' } 
    ] };
        expect(FN(RAW)).toEqual(EXPECTED);
    })
});