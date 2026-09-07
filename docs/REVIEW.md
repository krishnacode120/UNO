# Rewrite Review

The initial implementation compiled, but several important flows were incomplete. These findings drove the rewrite.

| Severity | Finding in the original implementation | Resolution |
| --- | --- | --- |
| High | The socket effect depended on room state, disconnecting and reconnecting after every update. | Stable connection lifecycle; private session reconnect credentials; independent multi-browser test. |
| High | The client connected to localhost:4000, which points to the phone itself on mobile. | Same-origin Socket.IO and API requests; Vite proxies the backend; production Express serves the client. |
| High | Any socket could add bots to a room; payloads were trusted TypeScript casts. | Zod input validation, membership and host checks, request throttling, room capacity checks. |
| High | Concurrent bot loops could mutate the same room after separate requests. | One authoritative scheduled task per room; synchronous state transitions; stale-version rejection. |
| High | Public profile IDs granted write access to profiles. | Private random device tokens, hashed server keys, validated guest-save API. |
| Medium | Players could play old cards after drawing; final draw penalties were excluded from scoring. | Restrict play to the drawn card; apply penalties before scoring. |
| Medium | Missed UNO did nothing; repeated calls inflated statistics. | Catch window, two-card penalty, repeated-call rejection and idempotent match recording. |
| Medium | Turn timer was a setting without enforcement. | Server and local timers, forced draw/pass, disconnected-player timeout. |
| Medium | Seven swaps accepted invalid targets; bots selected the largest opposing hand. | Validate targets, choose smallest hand, select targets in the UI, define last-card behavior. |
| Medium | Online statistics used the local profile ID instead of the multiplayer seat ID. | Record using the actual viewer seat and deduplicate by match ID. |
| Medium | The packaged server still referenced shared TypeScript source. | Bundle the shared engine into the server with tsup. |
| Medium | Nested card buttons, dimmed presentation cards, and vertical phone layouts hindered interaction. | Noninteractive card faces, semantic controls, compact responsive table, scrollable touch hand. |

## Verification

- Shared engine regressions and full matches across all three bot difficulties and optional rules.
- Socket integration: permissions, malformed data, full rooms, duplicate moves, private reconnect hands, timer expiry, host transfer.
- Playwright: desktop solo, two independent online players, reload/reconnect, persisted settings and daylight theme.
- Phone viewports: 320x640, 360x740, 390x844; landscape: 844x390.
- Production smoke: bundled server, same-origin sockets, guest API, offline app shell and solo play.
- TypeScript, ESLint and production builds.

## Explicit Rule Variants

This is an unofficial UNO-inspired game. Illegal Wild Draw Four plays are rejected, so there is no bluff/challenge phase. Opening discards are number cards. A final seven or zero wins immediately instead of transferring the empty hand. Optional stacking permits only the same draw type. These variants are stated in the Help screen.

## Deployment Boundaries

Live rooms are held by one Node process. Reconnect handles connection loss while that process remains alive; restarting it ends active rooms. MongoDB stores private profiles, preferences, personal statistics and match history when configured. Local development uses memory storage plus browser saves.

Personal statistics are device-reported, not a competitive ranking system. There is no account recovery or cross-device login. Horizontal scaling requires shared room storage and a Socket.IO adapter; this implementation must be deployed as a single instance until that is added.

Mobile support is a responsive installable web app, not native Android/iOS binaries. Bluetooth peer-to-peer play is deliberately not implemented: browser Web Bluetooth acts as a BLE central client and lacks the broad support this workflow requires. Room codes work across devices using a shared server over Wi-Fi, a hotspot, or the internet.
