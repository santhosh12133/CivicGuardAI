require('./env');

const bcrypt = require('bcryptjs');
const { createApp } = require('../../src/app');
const { sequelize, User } = require('../../src/models');
const { exiftool } = require('../../src/utils/exiftool');

const PASSWORD = 'correct-horse-battery';

/**
 * Starts the API on a random local port against a freshly reset database.
 * Returns a small client plus helpers for creating users of each role.
 */
const startTestServer = async () => {
  await sequelize.sync({ force: true });

  const app = createApp();
  const server = await new Promise((resolve) => {
    const s = app.listen(0, '127.0.0.1', () => resolve(s));
  });
  const baseUrl = `http://127.0.0.1:${server.address().port}`;

  const request = async (method, path, { token, json, form, headers = {} } = {}) => {
    const init = { method, headers: { ...headers } };
    if (token) init.headers.Authorization = `Bearer ${token}`;
    if (json !== undefined) {
      init.headers['Content-Type'] = 'application/json';
      init.body = JSON.stringify(json);
    } else if (form) {
      init.body = form;
    }
    const res = await fetch(`${baseUrl}${path}`, init);
    const text = await res.text();
    let body = text;
    try {
      body = text ? JSON.parse(text) : null;
    } catch {
      // Non-JSON body (e.g. an image); keep the raw text.
    }
    return { status: res.status, headers: res.headers, body };
  };

  let userCount = 0;
  const createUser = async (role) => {
    userCount += 1;
    const email = `${role}${userCount}@example.test`;
    const user = await User.create({
      name: `Test ${role} ${userCount}`,
      email,
      password: await bcrypt.hash(PASSWORD, 4),
      role,
    });
    const login = await request('POST', '/api/auth/login', { json: { email, password: PASSWORD } });
    if (login.status !== 200) throw new Error(`Login for ${email} failed: ${login.status}`);
    return { user, token: login.body.token, email };
  };

  const close = async () => {
    server.closeAllConnections?.();
    await new Promise((resolve) => server.close(resolve));
    await sequelize.close();
    await exiftool.end();
  };

  return { baseUrl, request, createUser, close, PASSWORD };
};

module.exports = { startTestServer };
