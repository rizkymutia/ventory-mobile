# Ventory — iOS production readiness checklist

## Automated gates (run on every PR)
- [ ] `npm ci` works from a clean clone
- [ ] `npm run typecheck` passes
- [ ] `npm run test:ci` passes: real SQLite queries via Node.js 24 `node:sqlite` adapter
- [ ] `npx expo install --check` reports compatible dependencies
- [ ] `.env`, local `.db`, exported JSON backups and test fixtures containing user data are not tracked

## Manual iPhone regression (Expo Go, test data only)
- [ ] 5 tabs navigate, no clipped footer/keyboard overlay
- [ ] Create/edit/delete product; SKU conflict is handled
- [ ] Sale of two items updates stock, sale history and dashboard once
- [ ] Overselling shows a useful error and changes nothing
- [ ] Edit/delete expense updates correct day/month reports
- [ ] Backup JSON to Files/iCloud Drive; verify the actual file is saved
- [ ] Corrupt backup rejected without change to SQLite
- [ ] Restore changes all four tables; safety snapshot can be recovered
- [ ] App restart preserves data
- [ ] Test airplane mode (offline); check accessibility labels and iPhone small screens

## iOS/TestFlight preparation (do NOT execute automatically)
- [ ] Confirm `expo.name: Ventory`, `slug: ventory-mobile`, `ios.bundleIdentifier` is owned/available
- [ ] Confirm final app icon, splash screen and any iOS permission usage descriptions in app config
- [ ] Set app version and increment iOS build number on every distribution build
- [ ] Prepare privacy policy URL, support contact, and accurate App Privacy answers in App Store Connect
- [ ] Decide data retention and storage protections: exported JSON currently **unencrypted**
- [ ] Audit use of Expo Go sandbox: standalone/TestFlight storage will be a separate app; export data before switching
- [ ] Have a paid Apple Developer membership and access to App Store Connect
- [ ] Use EAS Build production iOS profile, then TestFlight internal/external testing
- [ ] Re-run backup/restore regression **in the standalone/TestFlight app**, not only Expo Go
- [ ] Test install/update/uninstall behavior, foreground/background, interruptions and crash logs
- [ ] Validate low-storage handling and database migration with data from an older app build
- [ ] Only submit to App Store after privacy, security, stability and feature review are complete

## Notes
`node:sqlite` in Node 24 is used only in the test runner. App runtime continues to use `expo-sqlite` on iOS. No Apple Developer or EAS cloud build is performed by this package. Tests cannot prove the iOS file picker, sharing, splash screen, signing or actual App Store eligibility.
