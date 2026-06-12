#!/usr/bin/env node
/**
 * Create a user for the kitten tracker.
 *
 *   npm run create-user -- --username danny --role admin
 *
 * Plain CommonJS on purpose: inside the production container it runs with
 * `node scripts/create-user.cjs` against the standalone node_modules, where
 * tsx/TypeScript are not available.
 *
 * The password is prompted for interactively (hidden), or read from stdin when
 * piped. It is never accepted as a CLI argument.
 */
const fs = require("node:fs");
const path = require("node:path");
const readline = require("node:readline");
const Database = require("better-sqlite3");
const { drizzle } = require("drizzle-orm/better-sqlite3");
const { sqliteTable, text, integer } = require("drizzle-orm/sqlite-core");
const { hash, Algorithm } = require("@node-rs/argon2");

// Mirrors the columns of `users` in src/db/schema.ts that this script writes.
const users = sqliteTable("users", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  username: text("username").notNull(),
  passwordHash: text("password_hash").notNull(),
  role: text("role").notNull(),
});

const ROLES = ["admin", "viewer"];

function fail(message) {
  console.error(`Error: ${message}`);
  process.exit(1);
}

function parseArgs(argv) {
  const args = { username: null, role: null };
  for (let i = 0; i < argv.length; i++) {
    switch (argv[i]) {
      case "--username":
        args.username = argv[++i];
        break;
      case "--role":
        args.role = argv[++i];
        break;
      case "--password":
        fail("Passwords are never accepted as arguments. You will be prompted instead.");
        break;
      default:
        fail(`Unknown argument: ${argv[i]}`);
    }
  }
  return args;
}

function promptHidden(question) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    const baseWrite = rl._writeToOutput.bind(rl);
    let muted = false;
    rl._writeToOutput = (chunk) => {
      if (!muted) baseWrite(chunk);
    };
    rl.question(question, (answer) => {
      muted = false;
      rl.close();
      process.stdout.write("\n");
      resolve(answer);
    });
    muted = true;
  });
}

function readStdin() {
  return new Promise((resolve) => {
    let data = "";
    process.stdin.setEncoding("utf8");
    process.stdin.on("data", (chunk) => (data += chunk));
    process.stdin.on("end", () => resolve(data.split("\n")[0]));
  });
}

async function main() {
  const { username, role } = parseArgs(process.argv.slice(2));
  if (!username || !/^[a-zA-Z0-9._-]{1,64}$/.test(username)) {
    fail("--username is required (1-64 chars: letters, digits, . _ -)");
  }
  if (!role || !ROLES.includes(role)) {
    fail(`--role is required (one of: ${ROLES.join(", ")})`);
  }

  const password = process.stdin.isTTY
    ? await promptHidden(`Password for ${username}: `)
    : await readStdin();
  if (!password || password.length < 10 || password.length > 256) {
    fail("Password must be 10-256 characters.");
  }
  if (process.stdin.isTTY) {
    const confirm = await promptHidden("Confirm password: ");
    if (confirm !== password) fail("Passwords do not match.");
  }

  const databasePath = process.env.DATABASE_PATH || "./data/kittens.db";
  if (!fs.existsSync(databasePath)) {
    fail(
      `Database not found at ${databasePath}. Start the app once so migrations run, ` +
        `or set DATABASE_PATH.`,
    );
  }

  const sqlite = new Database(databasePath);
  sqlite.pragma("journal_mode = WAL");
  const db = drizzle(sqlite);

  // OWASP-recommended Argon2id parameters, kept in sync with src/lib/auth/password.ts
  const passwordHash = await hash(password, {
    algorithm: Algorithm.Argon2id,
    memoryCost: 19456,
    timeCost: 2,
    parallelism: 1,
  });

  try {
    db.insert(users).values({ username, passwordHash, role }).run();
  } catch (err) {
    if (String(err && err.message).includes("UNIQUE")) {
      fail(`User "${username}" already exists.`);
    }
    throw err;
  }
  console.log(`Created ${role} user "${username}" in ${path.resolve(databasePath)}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
