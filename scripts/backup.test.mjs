import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import {
  chmodSync,
  mkdtempSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const backupScript = fileURLToPath(new URL("./backup.sh", import.meta.url));

test("backup restricts existing directories and Docker outputs under a permissive umask", () => {
  const root = mkdtempSync(path.join(os.tmpdir(), "kitten-backup-test-"));
  try {
    const bin = path.join(root, "bin");
    const dest = path.join(root, "backups");
    const photos = path.join(root, "photos");
    mkdirSync(bin);
    mkdirSync(dest);
    mkdirSync(photos);
    chmodSync(dest, 0o777);
    writeFileSync(path.join(photos, "synthetic-photo.txt"), "synthetic photo");
    const docker = path.join(bin, "docker");
    writeFileSync(
      docker,
      `#!/usr/bin/env node
const fs = require('node:fs');
const cp = require('node:child_process');
const path = require('node:path');
const args = process.argv.slice(2);
if (args[0] === 'exec') {
  if (args[2] === 'node') {
    if (!args[4].includes('process.umask(0o077)') || !args[4].includes("chmodSync('/data/_backup.db', 0o600)")) process.exit(9);
  }
} else if (args[0] === 'cp') {
  fs.writeFileSync(args[2], 'synthetic database');
  fs.chmodSync(args[2], 0o644); // Docker can preserve a source mode despite the caller's umask.
} else if (args[0] === 'run') {
  if (!args.includes('--user') || args[args.indexOf('--user') + 1] !== process.getuid() + ':' + process.getgid()) process.exit(10);
  const dest = args[args.indexOf('-v', args.indexOf('-v') + 1) + 1].replace(/:backup$/, '').replace(/:\\/backup$/, '');
  const archive = args.at(-1).replace('/backup/', dest + '/');
  const script = args[args.indexOf('-c') + 1].replace('/photos', process.env.TEST_PHOTOS);
  const result = cp.spawnSync('sh', ['-c', script, 'sh', archive], {stdio:'inherit'});
  process.exit(result.status ?? 1);
} else process.exit(11);
`,
    );
    chmodSync(docker, 0o755);
    const result = spawnSync("bash", ["-c", 'umask 000; exec bash "$1"', "sh", backupScript], {
      env: {
        ...process.env,
        PATH: `${bin}:${process.env.PATH}`,
        BACKUP_DIR: dest,
        TEST_PHOTOS: photos,
      },
      encoding: "utf8",
    });
    assert.equal(result.status, 0, result.stderr);
    assert.equal(statSync(dest).mode & 0o777, 0o700);
    const files = readdirSync(dest);
    assert.equal(files.length, 2);
    for (const file of files) {
      assert.equal(statSync(path.join(dest, file)).mode & 0o777, 0o600);
      assert.equal(statSync(path.join(dest, file)).uid, process.getuid());
    }
    assert.equal(
      readFileSync(
        path.join(
          dest,
          files.find((file) => file.endsWith(".db")),
        ),
        "utf8",
      ),
      "synthetic database",
    );
    const restored = path.join(root, "restored");
    mkdirSync(restored);
    execFileSync("tar", [
      "xzf",
      path.join(
        dest,
        files.find((file) => file.endsWith(".tgz")),
      ),
      "-C",
      restored,
    ]);
    assert.equal(
      readFileSync(path.join(restored, "synthetic-photo.txt"), "utf8"),
      "synthetic photo",
    );
    const failed = spawnSync("bash", [backupScript], {
      env: {
        ...process.env,
        PATH: `${bin}:${process.env.PATH}`,
        BACKUP_DIR: dest,
        TEST_PHOTOS: path.join(root, "missing-photos"),
      },
      encoding: "utf8",
    });
    assert.notEqual(failed.status, 0, "tar errors must stop the backup");
    assert.doesNotMatch(failed.stdout, /Backup OK/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
