# Secret Rotation Checklist

The following secrets were committed to git and MUST be rotated before launch.
Run these commands, then set the new values in Railway > Variables.

## 1. Remove .env files from git tracking
```bash
git rm --cached backend/.env mobile/.env
git commit -m "chore: stop tracking .env files"
```

## 2. Rotate every secret that was in the committed .env files

### JWT_SECRET (invalidates all active sessions — all users must log in again)
```bash
openssl rand -hex 32
```
Set new value as `JWT_SECRET` in Railway.

### WORKER_SECRET
```bash
openssl rand -hex 32
```
Set new value as `WORKER_SECRET` in Railway.

### NIN_ENCRYPTION_KEY
```bash
openssl rand -hex 32
```
Set new value as `NIN_ENCRYPTION_KEY` in Railway. Note: existing encrypted NIN records will become unreadable — users must re-verify.

### FLUTTERWAVE_WEBHOOK_HASH
Generate a new random string:
```bash
openssl rand -hex 32
```
Set the same value in:
1. Railway > `FLUTTERWAVE_WEBHOOK_HASH`
2. Flutterwave dashboard > Settings > Webhooks > Secret Hash

### TERMII_API_KEY
Log in to https://accounts.termii.com and regenerate your API key.

### Cloudinary API Key + Secret
Log in to https://console.cloudinary.com > Settings > Access Keys > Revoke old key > Generate new.

### Facebook App Secret
Log in to https://developers.facebook.com > your app > Settings > Basic > Reset App Secret.

### TikTok Client Key + Secret
Log in to https://developers.tiktok.com > your app > Manage app > Regenerate client secret.

### Google Maps API Key
1. Log in to https://console.cloud.google.com > Credentials
2. Delete the old key
3. Create a new key with restriction: Android apps > Package name: com.skodztest.foodsbyme

### Sentry DSN
The DSN is not a secret (it's used in client code), but rotate it if you're concerned.

## 3. Set Flutterwave LIVE keys
Get from: https://dashboard.flutterwave.com → Settings → API Keys → Live

Set in Railway:
- `FLUTTERWAVE_SECRET_KEY` = FLWSECK_LIVE-...
- `FLUTTERWAVE_PUBLIC_KEY` = FLWPUBK_LIVE-...
- `FLUTTERWAVE_ENCRYPTION_KEY` = (from dashboard)

Set in mobile .env:
- `EXPO_PUBLIC_FLUTTERWAVE_PK` = FLWPUBK_LIVE-...

Then rebuild the APK:
```bash
cd mobile && eas build --platform android --profile production
```

## 4. Neon PITR verification
1. Log in to https://console.neon.tech
2. Go to your project > Settings > Backups
3. Confirm Point-in-Time Recovery is enabled (requires paid plan)
4. Confirm retention period is at least 7 days
5. Test a restore: create a branch from 1 hour ago, verify data

## 5. After all secrets are rotated
- Delete the committed .env files from git history (optional but recommended):
  ```bash
  git filter-repo --path backend/.env --invert-paths
  git filter-repo --path mobile/.env --invert-paths
  git push --force
  ```
- Verify no secrets are in the codebase: `git grep -r "FLWSECK\|FLWPUBK\|TLTcL\|npg_5a"`
