#!/usr/bin/env node
// Seeds a running CivicFix API with realistic data for the browser and
// emulator end-to-end tests, using only the public API (plus ExifTool to give
// the photos real camera metadata).
//
//   API_URL=http://localhost:5000 ADMIN_EMAIL=... ADMIN_PASSWORD=... \
//   SEED_OUT=/tmp/seed.json PHOTO_OUT=/tmp/fresh.jpg node test/e2e/seed.js
const fs = require('fs');
const path = require('path');
const { makePhoto, issueForm } = require('../helpers/photos');
const { exiftool } = require('../../src/utils/exiftool');

const API = (process.env.API_URL || 'http://localhost:5000').replace(/\/$/, '');
const BENGALURU = { lat: 12.9716, lon: 77.5946 };

const call = async (method, url, { token, json, form } = {}) => {
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  let body;
  if (json) {
    headers['Content-Type'] = 'application/json';
    body = JSON.stringify(json);
  } else if (form) {
    body = form;
  }
  const res = await fetch(`${API}${url}`, { method, headers, body });
  const text = await res.text();
  const data = text ? JSON.parse(text) : null;
  if (!res.ok) throw new Error(`${method} ${url} -> ${res.status}: ${text}`);
  return data;
};

const register = async (name, email, password) => {
  const { token, user } = await call('POST', '/api/auth/register', { json: { name, email, password } });
  return { token, user, email, password };
};

const main = async () => {
  const admin = await call('POST', '/api/auth/login', {
    json: { email: process.env.ADMIN_EMAIL, password: process.env.ADMIN_PASSWORD },
  });

  const asha = await register('Asha Citizen', 'asha@example.com', 'asha-password-1');
  const ravi = await register('Ravi Citizen', 'ravi@example.com', 'ravi-password-1');

  // 1. A pothole reported with a real, freshly taken photo.
  const photo = await makePhoto({ fixture: 'pothole.jpg', gps: BENGALURU });
  const form = issueForm({
    photo,
    lat: BENGALURU.lat,
    lon: BENGALURU.lon,
    title: 'Deep pothole on MG Road',
    description: 'Two-wheelers are swerving into traffic to avoid it.',
  });
  form.append('category', 'pothole');
  const pothole = await call('POST', '/api/issues', { token: asha.token, form });

  // 2. A streetlight, which staff have started working on.
  const streetlight = await call('POST', '/api/issues', {
    token: asha.token,
    json: {
      title: 'Streetlight out near bus stop',
      description: 'Dark for a week, unsafe at night.',
      category: 'streetlight',
      // A remote photo URL (no EXIF to check), so the report is flagged for review.
      photo_url: 'https://images.example.com/report.jpg',
      latitude: BENGALURU.lat + 0.001,
      longitude: BENGALURU.lon,
    },
  });
  await call('PUT', `/api/issues/${streetlight.id}`, {
    token: admin.token,
    json: { status: 'In Progress', note: 'Crew scheduled for Monday' },
  });

  // 3. Garbage reported by someone else.
  const garbage = await call('POST', '/api/issues', {
    token: ravi.token,
    json: {
      title: 'Garbage pile on 5th Cross',
      description: 'Not collected for three days.',
      category: 'garbage',
      // A remote photo URL (no EXIF to check), so the report is flagged for review.
      photo_url: 'https://images.example.com/report.jpg',
      latitude: BENGALURU.lat,
      longitude: BENGALURU.lon + 0.001,
    },
  });

  const seed = {
    api: API,
    admin: { email: process.env.ADMIN_EMAIL, password: process.env.ADMIN_PASSWORD },
    asha: { email: asha.email, password: asha.password, name: asha.user.name },
    ravi: { email: ravi.email, password: ravi.password, name: ravi.user.name },
    issues: { pothole: pothole.id, streetlight: streetlight.id, garbage: garbage.id },
  };
  if (process.env.SEED_OUT) fs.writeFileSync(process.env.SEED_OUT, JSON.stringify(seed, null, 2));

  // A fresh camera photo for the phone to pick from its gallery.
  if (process.env.PHOTO_OUT) {
    const fresh = await makePhoto({ fixture: 'streetlight.jpg', gps: BENGALURU });
    fs.mkdirSync(path.dirname(process.env.PHOTO_OUT), { recursive: true });
    fs.writeFileSync(process.env.PHOTO_OUT, fresh);
  }

  console.log(JSON.stringify(seed, null, 2));
};

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => exiftool.end());
