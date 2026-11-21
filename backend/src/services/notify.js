const { awsRequest, region } = require('./aws');

// Sends sign-in codes and password-reset codes.
//
// EMAIL_PROVIDER: "ses" (Amazon SES; needs EMAIL_FROM, a verified sender)
//                 or "log" (development/tests: messages are logged, not sent)
// SMS_PROVIDER:   "sns" (Amazon SNS) or "log"
//
// For SMS to Indian numbers, telecom (DLT) rules require a registered sender
// and template: set SMS_SENDER_ID, SMS_ENTITY_ID and SMS_TEMPLATE_ID.

const emailProvider = () => process.env.EMAIL_PROVIDER || (process.env.NODE_ENV === 'production' ? '' : 'log');
const smsProvider = () => process.env.SMS_PROVIDER || (process.env.NODE_ENV === 'production' ? '' : 'log');

const emailConfigured = () =>
  emailProvider() === 'log' || (emailProvider() === 'ses' && Boolean(process.env.EMAIL_FROM));
const smsConfigured = () => ['log', 'sns'].includes(smsProvider());

// Messages "sent" in log mode, newest last (tests read these).
const outbox = [];

const logMessage = (kind, to, text) => {
  outbox.push({ kind, to, text, at: new Date() });
  if (outbox.length > 200) outbox.shift();
  // Log mode is for development and tests only: the message, including any
  // code, goes to the server log.
  console.log(`[notify:${kind}] to ${to}: ${text}`);
};

const sendEmail = async ({ to, subject, text }) => {
  const provider = emailProvider();
  if (provider === 'log') return logMessage('email', to, `${subject} — ${text}`);
  if (provider !== 'ses') throw new Error('Email is not configured (set EMAIL_PROVIDER)');

  await awsRequest({
    service: 'ses',
    url: `https://email.${region()}.amazonaws.com/v2/email/outbound-emails`,
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      FromEmailAddress: process.env.EMAIL_FROM,
      Destination: { ToAddresses: [to] },
      Content: {
        Simple: {
          Subject: { Data: subject, Charset: 'UTF-8' },
          Body: { Text: { Data: text, Charset: 'UTF-8' } },
        },
      },
    }),
  });
  return undefined;
};

const sendSms = async ({ to, text }) => {
  const provider = smsProvider();
  if (provider === 'log') return logMessage('sms', to, text);
  if (provider !== 'sns') throw new Error('SMS is not configured (set SMS_PROVIDER)');

  const params = new URLSearchParams({
    Action: 'Publish',
    Version: '2010-03-31',
    PhoneNumber: to,
    Message: text,
  });
  const attributes = [['AWS.SNS.SMS.SMSType', 'Transactional']];
  if (process.env.SMS_SENDER_ID) attributes.push(['AWS.SNS.SMS.SenderID', process.env.SMS_SENDER_ID]);
  if (process.env.SMS_ENTITY_ID) attributes.push(['AWS.MM.SMS.EntityId', process.env.SMS_ENTITY_ID]);
  if (process.env.SMS_TEMPLATE_ID) attributes.push(['AWS.MM.SMS.TemplateId', process.env.SMS_TEMPLATE_ID]);
  attributes.forEach(([name, value], index) => {
    const n = index + 1;
    params.set(`MessageAttributes.entry.${n}.Name`, name);
    params.set(`MessageAttributes.entry.${n}.Value.DataType`, 'String');
    params.set(`MessageAttributes.entry.${n}.Value.StringValue`, value);
  });

  await awsRequest({
    service: 'sns',
    url: `https://sns.${region()}.amazonaws.com/`,
    headers: { 'content-type': 'application/x-www-form-urlencoded; charset=utf-8' },
    body: params.toString(),
  });
  return undefined;
};

module.exports = { sendEmail, sendSms, emailConfigured, smsConfigured, outbox };
