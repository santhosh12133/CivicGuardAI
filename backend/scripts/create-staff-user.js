#!/usr/bin/env node
// Creates a staff or admin account (the admin portal only accepts these roles;
// public sign-up only creates citizens). Also resets the password and role of
// an existing account with the same email.
//
//   npm run create-staff -- --email you@city.gov --name "Your Name" --role admin
//
// The password is read from STAFF_PASSWORD if set (12+ characters); otherwise
// a strong random password is generated and printed once.
//
// Against a deployed database, run it from your own computer with the
// database's EXTERNAL connection URL, e.g. on Render:
//   DATABASE_URL="<External Database URL>" DATABASE_SSL=true npm run create-staff -- ...
require('dotenv').config();

const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const { sequelize, User, roles } = require('../src/models');
const { syncSchema } = require('../src/config/schema');

const STAFF_ROLES = roles.filter((role) => role !== 'citizen');

const parseArgs = (argv) => {
  const args = {};
  for (let i = 0; i < argv.length; i += 1) {
    const match = argv[i].match(/^--([a-z]+)(?:=(.*))?$/);
    if (!match) continue;
    const [, key, inline] = match;
    args[key] = inline !== undefined ? inline : argv[i + 1];
    if (inline === undefined) i += 1;
  }
  return args;
};

const usage = () => {
  console.error(
    'Usage: npm run create-staff -- --email <email> --name "<full name>" --role <staff|admin>\n' +
      'Set STAFF_PASSWORD to choose the password; otherwise one is generated.'
  );
  process.exit(1);
};

const main = async () => {
  const args = parseArgs(process.argv.slice(2));
  const { name, role = 'staff' } = args;
  const email = String(args.email || '').trim().toLowerCase();
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !name) usage();
  if (!STAFF_ROLES.includes(role)) {
    console.error(`--role must be one of: ${STAFF_ROLES.join(', ')}`);
    process.exit(1);
  }

  let password = process.env.STAFF_PASSWORD;
  const generated = !password;
  if (generated) {
    password = crypto.randomBytes(18).toString('base64url');
  } else if (password.length < 12) {
    console.error('STAFF_PASSWORD must be at least 12 characters.');
    process.exit(1);
  }

  await sequelize.authenticate();
  // Creates the tables on a brand-new database (no-op when they exist).
  await syncSchema();

  const hashed = await bcrypt.hash(password, 10);
  const existing = await User.findOne({ where: { email } });
  if (existing) {
    await existing.update({ name, role, password: hashed });
    console.log(`Updated existing account ${email} (role: ${role}).`);
  } else {
    await User.create({ name, email, role, password: hashed });
    console.log(`Created ${role} account ${email}.`);
  }

  if (generated) {
    console.log(`\nPassword (shown once, store it in a password manager): ${password}\n`);
  }
};

main()
  .catch((error) => {
    console.error('Failed:', error.message);
    process.exitCode = 1;
  })
  .finally(() => sequelize.close());
