# support-chat-web

The customer-support chat page for the Brocent conversational support
platform. A deliberately small, standalone React app: it renders a chat
conversation backed by a self-hosted [OpenIM](https://github.com/openimsdk)
server, and nothing else.

It is developed and published as an independent application (embedded by the
host system via `<iframe>`) and has **zero imports** from any other Brocent
codebase. Its entire API surface toward the host backend is two endpoints:

- `POST /api/openim/device-token/` — anonymous device identity (a customer
  asking for help from a managed device; authenticated by a signed per-device
  token in the page URL)
- `POST /api/openim/token/` — logged-in identity (staff/portal users;
  authenticated by the host session/bearer token)

## Modes

| URL | Who | Auth |
|---|---|---|
| `/?t=<signed-device-token>` | Customer on a managed device | the signed token itself |
| `/?mode=staff&group=<groupID>` | Technician (embedded in the host workbench) | host session cookie |
| `/?mode=portal&group=<groupID>` | Signed-in customer/vendor portal user | credentials handed in via `postMessage` by the embedding host page (see `src/portalBridge.ts`) — this app makes **zero** backend calls of its own in this mode; the host already minted them via its own same-origin `POST /api/openim/token/` call |

Portal mode's embedding host must, after this app signals readiness
(`{source:'bcs-beam-chat', type:'ready'}`, posted to `window.parent`), reply
with `{source:'bcs-beam-host', type:'openim-credentials', openimUserID,
token, expireTimeSeconds}`. Set `VITE_TRUSTED_PARENT_ORIGIN` in production to
the real portal origin — unset, this app accepts a credentials message from
any embedding page, which is fine for local dev only.

## Develop

```bash
npm install
npm run dev
```

`VITE_API_BASE` defaults to same-origin `/api`. `VITE_TRUSTED_PARENT_ORIGIN`
is unset by default (see Modes above).

## License

GPL-3.0-only (see LICENSE). Copyright © 2026 Brocent Cloud Service —
copyright remains with Brocent; GPL-3.0 is the license it is offered under.
This app bundles `@openim/client-sdk` (GPL-3.0), which is why the app itself
is GPL: see NOTICE.
