const { getClientIp, setCorsHeaders, isLocalhostOrigin, isVercelOrigin, isConfiguredOrigin, getRequestOrigin, getConfiguredOrigins, normalizeIp } = require('./http');

describe('getClientIp()', () => {
    const FN = getClientIp;
    const createReq = (headers) => ({ headers });

    it('should return the first IP from x-forwarded-for header', () => {
        const req = createReq({ 'x-forwarded-for': '192.168.0.1, 192.168.0.2' });
        expect(FN(req)).toBe('192.168.0.1');
    });

    it('should return the IP from x-real-ip header if x-forwarded-for is not present', () => {
        const req = createReq({ 'x-real-ip': '192.168.0.3' });
        expect(FN(req)).toBe('192.168.0.3');
    });

    it('should return an empty string if no IP headers are present', () => {
        const req = createReq({});
        expect(FN(req)).toBe('');
    });
});
describe('getRequestOrigin()', () => {
    const FN = getRequestOrigin;
    const createReq = (origin) => ({ headers: { origin } });
    
    it('should return the origin from headers', () => {
        const req = createReq('https://example.com');
        expect(FN(req)).toBe('https://example.com');
    });
    it('should return an empty string if no origin header is present', () => {
        const req = createReq(undefined);
        expect(FN(req)).toBe('');
    });
});
describe('getConfiguredOrigins()', () => {
    const FN = getConfiguredOrigins;
    const ALLOWED_ORIGINS = [
        'https://allowed1.com, https://allowed2.com',
        'https://app-origin.com',
        'https://pendler-alarm.de',
        'https://pendler-alarm-de.vercel.app'
    ];

    it('should return configured origins from environment variables', () => {
        const origins = FN(ALLOWED_ORIGINS);
        expect(origins).toContain('https://allowed1.com');
        expect(origins).toContain('https://allowed2.com');
        expect(origins).toContain('https://app-origin.com');
    });

    it('should include default origins', () => {
        const origins = FN(ALLOWED_ORIGINS);
        expect(origins).toContain('https://pendler-alarm.de');
        expect(origins).toContain('https://pendler-alarm-de.vercel.app');
    });

    it('should return an empty array if no origins are configured', () => {

        const origins = FN([]);
        expect(origins).toEqual([]);
    });
});
describe('isLocalhostOrigin()', () => {
    const FN = isLocalhostOrigin;
    const createUrl = (hostname) => new URL(`https://${hostname}`);

    it('should return true for localhost', () => {
        expect(FN(createUrl('localhost'))).toBe(true);
        expect(FN(createUrl('127.0.0.1'))).toBe(true);
    });
    it('should return false for other hosts', () => {
        expect(FN(createUrl('example.com'))).toBe(false);
    });
});
describe('isVercelOrigin()', () => {
    const FN = isVercelOrigin;
    const createUrl = (hostname) => new URL(`https://${hostname}`);

    it('should return true for vercel app domains', () => {
        expect(FN(createUrl('myapp.vercel.app'))).toBe(true);
        expect(FN(createUrl('anotherapp.vercel.app'))).toBe(true);
    });
    it('should return false for non-vercel domains', () => {
        expect(FN(createUrl('example.com'))).toBe(false);
        expect(FN(createUrl('vercel.com'))).toBe(false);
    });
});
describe('isConfiguredOrigin()', () => {
    const FN = isConfiguredOrigin;
    const configuredOrigins = ['https://allowed1.com', 'https://allowed2.com'];

    it('should return true for origins in the configured list', () => {
        expect(FN('https://allowed1.com', configuredOrigins)).toBe(true);
        expect(FN('https://allowed2.com', configuredOrigins)).toBe(true);
    });
    it('should return false for origins not in the configured list', () => {
        expect(FN('https://notallowed.com', configuredOrigins)).toBe(false);
    });
});

describe('setCorsHeaders()', () => {
    const FN = setCorsHeaders;
    const createReq = (origin) => ({ headers: { origin } });
    const createRes = () => {
        const headers = {};
        return {
            setHeader(key, value) {
                headers[key] = value;
            },
            status() {
                return this;
            },
            json() {
                return this;
            },
            getHeaders: () => headers
        };
    };

    it('should set base CORS headers', () => {
        const req = createReq('https://example.com');
        const res = createRes();
        const EXPECTED = {
            'Access-Control-Allow-Methods': 'GET, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type',
            'Access-Control-Max-Age': '86400'
        }

        FN(req, res, () => '');

        const headers = res.getHeaders();
        expect(headers).toMatchObject(EXPECTED);
    });

    it('should set origin headers when resolver returns an allowed origin', () => {
        const req = createReq('https://pendler-alarm.de');
        const res = createRes();
        const EXPECTED = {
            'Access-Control-Allow-Origin': 'https://pendler-alarm.de',
            'Vary': 'Origin'
        }

        FN(req, res, () => 'https://pendler-alarm.de');

        const headers = res.getHeaders();
        expect(headers).toMatchObject(EXPECTED);
    });
});
describe('normalizeIp()', () => {
    const FN = normalizeIp;
    it('should return the same IP if it is valid', () => {
        expect(FN('123.24.27.12')).toEqual('123.24.27.12');
        expect(FN('2001:0db8:85a3:0000:0000:8a2e:0370:7334')).toEqual('2001:0db8:85a3:0000:0000:8a2e:0370:7334');
        expect(FN('::ffff:0db8:85a3:0000:0000:8a2e:0370:7334')).toEqual('0db8:85a3:0000:0000:8a2e:0370:7334');
    });
    it('should return an empty string for invalid IPs', () => {
        // expect(FN('invalid-ip')).toEqual(''); // TODO
        expect(FN(undefined)).toEqual('');
    });
});
