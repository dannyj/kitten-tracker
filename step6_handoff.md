step1_handoff.md
step2_handoff.md
tracker_plan.md

Claude Code Handoff — Kitten Tracker, Step 6: Photos & Age-at-Photo
Objective
Add photo upload for kittens and mothers, with the date a photo was taken pulled from EXIF and used to show how old the kitten was in that shot — turning each kitten's gallery into a visual growth timeline. "Done" means: I upload a photo, the app shows "Muis, 3w 2d" from the photo's own metadata (with a manual override when metadata is missing or wrong), and each kitten/mother has a clean chronological gallery. Uploads are handled securely since this is the highest-risk surface in the app.
Prerequisites
Steps 1–5 complete. The photos table exists (subject_type kitten|mother, subject_id, file_path, taken_at, taken_at_source exif|manual|upload, caption, created_at). Kitten and mother detail pages have photo placeholder slots from steps 2. Docker has a kitten-photos:/photos volume from step 1.
Tasks

1. Secure upload pipeline (do this part carefully — it's the main attack surface)
   • Accept JPEG, PNG, WebP, HEIC/HEIF (phones shoot HEIC). Reject everything else.
   • Validate by content sniffing (magic bytes), not file extension or client-sent MIME
   • Enforce a max file size (e.g. 15 MB) before processing
   • Read EXIF first (for the date), then re-encode the image with sharp to strip all remaining metadata and any embedded payload. The stored file is always a freshly re-encoded JPEG/WebP — never the original bytes.
   • Store under the /photos volume with a UUID filename, outside any web-served static path. Subfolder by subject for tidiness (/photos/kitten/<id>/<uuid>.webp).
   • Generate and store a thumbnail (sharp resize) for gallery/list performance
   • Convert HEIC to web-friendly format during re-encode (HEIC won't display in most browsers)
   • Strip GPS/location EXIF entirely — never persist or display it (privacy; home coordinates often sit in phone photos)
2. Serving images securely
   • Photos are served through an authenticated route, not as public static files — a session is required to view any image. (A LAN app today, internet-facing tomorrow: don't leave an open image directory.)
   • Validate the requested ID and that the file resolves inside /photos (guard against path traversal); unknown → 404
   • Set correct content-type and sensible cache headers on the authenticated route
3. EXIF date → age-at-photo
   • On upload, read DateTimeOriginal from EXIF with exifr. Set taken_at and taken_at_source=exif.
   • If EXIF has no date, fall back to taken_at_source=upload using upload time, and surface a gentle "couldn't read photo date — set it manually?" prompt
   • Manual override on any photo: edit taken_at, sets taken_at_source=manual
   • Age-at-photo = taken_at − kitten birth date, displayed on the photo ("3w 2d") and as a caption option. For mother photos there's no age — just show the date.
   • Sanity check: if taken_at is before the kitten's birth date, flag it ("photo dated before birth — check the date") rather than showing a negative age. Phone clocks and wrong EXIF happen.
   • Show the source as a small indicator (from photo / set manually) so a manual date isn't mistaken for verified metadata
4. Galleries
   • Per-kitten gallery on the detail page: thumbnails in chronological order (by taken_at), each showing age-at-photo. This is effectively the growth timeline.
   • Per-mother gallery: chronological by date, no age
   • Lightbox/full view on tap: full image, date, age, caption, source indicator; edit caption/date and delete (delete removes file + thumbnail + row — this one is a real delete, with a confirm, since it's the foster's own photo, not an audit record)
   • A "cover photo" per kitten: pick one photo to represent the kitten in list views and the dashboard (nice touch — puts a face to each name in the rotation). Default to most recent if unset.
5. Performance & UX
   • Serve thumbnails in lists/galleries, full image only in the lightbox
   • Upload UX: show progress, allow multiple files in one go (a batch of litter photos), handle each independently so one failure doesn't sink the batch
   • Phone-first: the camera/upload control should make it easy to shoot-and-upload on mobile
6. Validation & security recap
   • Magic-byte type check, size cap, re-encode-always, UUID names, authenticated serving, path-traversal guard, GPS stripped
   • All mutations Zod-validated, session required, subject ID validated and ownership/existence checked
   • The re-encode step is the security keystone — never serve original uploaded bytes back
   Acceptance criteria
   1 Uploading a phone JPEG with EXIF shows the correct age-at-photo; a file with no date falls back and prompts for manual entry
   2 A HEIC upload is converted and displays in-browser; a non-image file (e.g. a renamed .txt/.pdf) is rejected by content sniffing, not just extension
   3 Stored files are re-encoded (verify: no original EXIF, no GPS, in the stored file) and have UUID names outside any static path
   4 Images are only retrievable with a valid session; a path-traversal attempt (../) is blocked; unknown ID → 404
   5 A photo dated before the birth date is flagged, not shown as a negative age; manual override sets source=manual and recomputes age
   6 Per-kitten gallery is chronological with ages; cover photo selection reflects in list/dashboard
   7 Delete removes file, thumbnail, and DB row after a confirm
   8 Batch upload: multiple files succeed independently; one bad file doesn't fail the rest
   9 Phone viewport 390px: upload, gallery, and lightbox usable
   10 TypeScript strict + lint pass; npm audit clean
   Out of scope
   Final dashboard polish (step 8), internet exposure, any AI/auto-tagging of photos, video. Birth-date verification "through photo metadata" from the original brief is interpreted narrowly here: the app uses EXIF dates to compute age-at-photo and flags impossible dates — it does not attempt to infer or guess a kitten's birth date from image content.
   Reference
   • Project plan: tracker_plan.md
   • Step 1–5 handoffs
   A note on why uploads get extra care
   File upload is the single most-abused web feature, and this app is slated to face the internet later. The non-negotiables: validate by content not filename, re-encode every image so the bytes you serve are bytes you generated (this neutralizes embedded payloads and polyglot files), serve only through an authenticated route, and strip GPS so the app never leaks where the foster lives. None of this is visible to the user — it's the part that lets the app safely leave the LAN later without a rewrite.
