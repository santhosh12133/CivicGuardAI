const crypto = require('crypto');

// Minimal AWS Signature Version 4 signing, enough to call Amazon SES and SNS
// without the AWS SDK. See
// https://docs.aws.amazon.com/IAM/latest/UserGuide/reference_sigv-create-signed-request.html

const sha256Hex = (data) => crypto.createHash('sha256').update(data, 'utf8').digest('hex');
const hmac = (key, data) => crypto.createHmac('sha256', key).update(data, 'utf8').digest();

// RFC 3986 encoding as AWS expects (encodeURIComponent leaves !'()* alone).
const awsEncode = (value) =>
  encodeURIComponent(value).replace(/[!'()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);

const canonicalQuery = (searchParams) =>
  [...searchParams.entries()]
    .map(([k, v]) => [awsEncode(k), awsEncode(v)])
    .sort(([a, av], [b, bv]) => (a === b ? (av < bv ? -1 : av > bv ? 1 : 0) : a < b ? -1 : 1))
    .map(([k, v]) => `${k}=${v}`)
    .join('&');

/**
 * Signs a request. Returns the headers to send (including Authorization).
 *
 * @param {object} opts
 * @param {string} opts.method
 * @param {string} opts.url
 * @param {object} [opts.headers]  extra headers to sign (e.g. content-type)
 * @param {string} [opts.body]
 * @param {string} opts.service    e.g. "ses", "sns"
 * @param {string} opts.region
 * @param {{ accessKeyId, secretAccessKey, sessionToken? }} opts.credentials
 * @param {Date}   [opts.date]
 */
const signRequest = ({ method, url, headers = {}, body = '', service, region, credentials, date = new Date() }) => {
  const parsed = new URL(url);
  const amzDate = date.toISOString().replace(/[:-]|\.\d{3}/g, '');
  const dateStamp = amzDate.slice(0, 8);

  const allHeaders = { ...headers, host: parsed.host, 'x-amz-date': amzDate };
  if (credentials.sessionToken) allHeaders['x-amz-security-token'] = credentials.sessionToken;

  const lowered = Object.fromEntries(
    Object.entries(allHeaders).map(([k, v]) => [k.toLowerCase(), String(v).trim().replace(/\s+/g, ' ')])
  );
  const signedHeaderNames = Object.keys(lowered).sort();
  const canonicalHeaders = signedHeaderNames.map((name) => `${name}:${lowered[name]}\n`).join('');
  const signedHeaders = signedHeaderNames.join(';');

  const canonicalRequest = [
    method.toUpperCase(),
    parsed.pathname.split('/').map(awsEncode).join('/') || '/',
    canonicalQuery(parsed.searchParams),
    canonicalHeaders,
    signedHeaders,
    sha256Hex(body),
  ].join('\n');

  const scope = `${dateStamp}/${region}/${service}/aws4_request`;
  const stringToSign = ['AWS4-HMAC-SHA256', amzDate, scope, sha256Hex(canonicalRequest)].join('\n');

  const kDate = hmac(`AWS4${credentials.secretAccessKey}`, dateStamp);
  const kRegion = hmac(kDate, region);
  const kService = hmac(kRegion, service);
  const kSigning = hmac(kService, 'aws4_request');
  const signature = crypto.createHmac('sha256', kSigning).update(stringToSign, 'utf8').digest('hex');

  return {
    ...allHeaders,
    authorization: `AWS4-HMAC-SHA256 Credential=${credentials.accessKeyId}/${scope}, SignedHeaders=${signedHeaders}, Signature=${signature}`,
  };
};

let cachedCredentials = null;

/**
 * Credentials from the environment, or from the ECS task role (the container
 * credentials endpoint) when running on AWS ECS/Fargate.
 */
const getCredentials = async () => {
  if (process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY) {
    return {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
      sessionToken: process.env.AWS_SESSION_TOKEN,
    };
  }
  if (cachedCredentials && cachedCredentials.expiresAt - Date.now() > 5 * 60 * 1000) {
    return cachedCredentials;
  }
  const relative = process.env.AWS_CONTAINER_CREDENTIALS_RELATIVE_URI;
  const full = process.env.AWS_CONTAINER_CREDENTIALS_FULL_URI;
  if (!relative && !full) {
    throw new Error('No AWS credentials: set AWS_ACCESS_KEY_ID/AWS_SECRET_ACCESS_KEY or run with an ECS task role');
  }
  const headers = {};
  if (process.env.AWS_CONTAINER_AUTHORIZATION_TOKEN) {
    headers.Authorization = process.env.AWS_CONTAINER_AUTHORIZATION_TOKEN;
  }
  const res = await fetch(full || `http://169.254.170.2${relative}`, { headers });
  if (!res.ok) throw new Error(`Could not get AWS credentials (${res.status})`);
  const data = await res.json();
  cachedCredentials = {
    accessKeyId: data.AccessKeyId,
    secretAccessKey: data.SecretAccessKey,
    sessionToken: data.Token,
    expiresAt: new Date(data.Expiration).getTime(),
  };
  return cachedCredentials;
};

const region = () => process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION || 'ap-south-1';

/** Sends a signed request to an AWS service and returns the response text. */
const awsRequest = async ({ service, method = 'POST', url, headers = {}, body = '' }) => {
  const credentials = await getCredentials();
  const signed = signRequest({ method, url, headers, body, service, region: region(), credentials });
  const res = await fetch(url, { method, headers: signed, body: method === 'GET' ? undefined : body });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`${service} request failed (${res.status}): ${text.slice(0, 300)}`);
  }
  return text;
};

module.exports = { signRequest, getCredentials, awsRequest, awsEncode, region };
