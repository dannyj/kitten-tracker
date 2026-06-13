// Generates real image fixtures for the step-6 e2e into /tmp/photo-fixtures.
// Requires macOS `sips` for the HEIC fixture (decode path is pure-JS in app).
const sharp = require("sharp");
const fs = require("node:fs");
const { execFileSync } = require("node:child_process");

const DIR = "/tmp/photo-fixtures";
fs.mkdirSync(DIR, { recursive: true });

(async () => {
  // 1) JPEG with EXIF DateTimeOriginal (2026-05-20) — for age-at-photo.
  const withExif = await sharp({
    create: { width: 200, height: 200, channels: 3, background: { r: 200, g: 120, b: 90 } },
  })
    .jpeg()
    .withExif({ IFD2: { DateTimeOriginal: "2026:05:20 10:30:00" } })
    .toBuffer();
  fs.writeFileSync(`${DIR}/with-exif.jpg`, withExif);

  // 2) PNG with no EXIF date — triggers upload-time fallback.
  const noExif = await sharp({
    create: { width: 200, height: 200, channels: 3, background: { r: 90, g: 160, b: 120 } },
  })
    .png()
    .toBuffer();
  fs.writeFileSync(`${DIR}/no-exif.png`, noExif);

  // 3) A couple more JPEGs for batch upload.
  for (const [name, c] of [
    ["batch-a.jpg", { r: 10, g: 80, b: 200 }],
    ["batch-b.jpg", { r: 220, g: 200, b: 30 }],
  ]) {
    fs.writeFileSync(
      `${DIR}/${name}`,
      await sharp({ create: { width: 150, height: 150, channels: 3, background: c } })
        .jpeg()
        .toBuffer(),
    );
  }

  // 4) HEIC via macOS sips (real ftypheic the pure-JS decoder can read).
  const tmpJpg = `${DIR}/_src.jpg`;
  fs.writeFileSync(
    tmpJpg,
    await sharp({ create: { width: 200, height: 200, channels: 3, background: { r: 150, g: 90, b: 180 } } })
      .jpeg()
      .toBuffer(),
  );
  execFileSync("sips", ["-s", "format", "heic", tmpJpg, "--out", `${DIR}/phone.heic`]);

  // 5) A non-image disguised as a .jpg — must be rejected by content sniffing.
  fs.writeFileSync(`${DIR}/fake.jpg`, "This is definitely not an image, just text pretending.\n");

  console.log("Fixtures written to", DIR);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
