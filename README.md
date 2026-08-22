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

## Develop

```bash
npm install
npm run dev
```

`VITE_API_BASE` defaults to same-origin `/api`.

## License

GPL-3.0-only (see LICENSE). Copyright © 2026 Brocent Cloud Service —
copyright remains with Brocent; GPL-3.0 is the license it is offered under.
This app bundles `@openim/client-sdk` (GPL-3.0), which is why the app itself
is GPL: see NOTICE.
