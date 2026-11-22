const test = require('node:test');
const assert = require('node:assert/strict');
const { signRequest, awsEncode } = require('../../src/services/aws');

// The worked example from the AWS Signature Version 4 documentation
// (IAM ListUsers, 2015-08-30, example credentials).
test('matches the AWS documentation example signature', () => {
  const headers = signRequest({
    method: 'GET',
    url: 'https://iam.amazonaws.com/?Action=ListUsers&Version=2010-05-08',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=utf-8' },
    body: '',
    service: 'iam',
    region: 'us-east-1',
    credentials: { accessKeyId: 'AKIDEXAMPLE', secretAccessKey: 'wJalrXUtnFEMI/K7MDENG+bPxRfiCYEXAMPLEKEY' },
    date: new Date('2015-08-30T12:36:00Z'),
  });
  assert.equal(headers['x-amz-date'], '20150830T123600Z');
  assert.equal(
    headers.authorization,
    'AWS4-HMAC-SHA256 Credential=AKIDEXAMPLE/20150830/us-east-1/iam/aws4_request, ' +
      'SignedHeaders=content-type;host;x-amz-date, ' +
      'Signature=5d672d79c15b13162d9279b0855cfba6789a8edb4c82c400e06b5924a6f2b5d7'
  );
});

test('signs the session token for temporary (ECS task role) credentials', () => {
  const headers = signRequest({
    method: 'POST',
    url: 'https://sns.ap-south-1.amazonaws.com/',
    body: 'Action=Publish',
    service: 'sns',
    region: 'ap-south-1',
    credentials: { accessKeyId: 'ASIAEXAMPLE', secretAccessKey: 'secret', sessionToken: 'token123' },
  });
  assert.equal(headers['x-amz-security-token'], 'token123');
  assert.match(headers.authorization, /SignedHeaders=host;x-amz-date;x-amz-security-token,/);
});

test('encodes like AWS (RFC 3986)', () => {
  assert.equal(awsEncode("a b+c!*'()"), 'a%20b%2Bc%21%2A%27%28%29');
});
