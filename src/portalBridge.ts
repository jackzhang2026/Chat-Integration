// Copyright © 2026 Brocent Cloud Service. All rights reserved.
// SPDX-License-Identifier: GPL-3.0-only
//
// "Portal" mode (2026-08-26): a signed-in customer/vendor portal user
// embedding this app in their own portal page. Unlike device mode (this app
// calls /openim/device-token/ itself, AllowAny + a signed per-device token)
// or staff mode (this app calls /openim/token/ itself, relying on the shared
// host session cookie), portal mode makes ZERO backend calls of its own —
// the host page is a real browser tab already on the portal's own origin,
// so IT calls /openim/token/ (a same-origin bearer-token request, which the
// host's api/portal_authentication.py can already authenticate) and hands
// the resulting OpenIM credentials across the iframe boundary via
// postMessage. This keeps this app's "two endpoints" surface (see README)
// unchanged — it adds a THIRD CREDENTIAL SOURCE, not a third endpoint call.
import type { OpenIMCredentials } from './backendApi';

const HOST_MESSAGE_SOURCE = 'bcs-beam-host';
const CHAT_MESSAGE_SOURCE = 'bcs-beam-chat';
const READY_TIMEOUT_MS = 15000;

interface HostCredentialsMessage {
  source: typeof HOST_MESSAGE_SOURCE;
  type: 'openim-credentials';
  openimUserID: string;
  token: string;
  expireTimeSeconds?: number;
}

const isHostCredentialsMessage = (data: unknown): data is HostCredentialsMessage => (
  !!data
  && typeof data === 'object'
  && (data as { source?: unknown }).source === HOST_MESSAGE_SOURCE
  && (data as { type?: unknown }).type === 'openim-credentials'
  && typeof (data as { openimUserID?: unknown }).openimUserID === 'string'
  && typeof (data as { token?: unknown }).token === 'string'
);

/**
 * Announces readiness to the parent frame, then waits for it to postMessage
 * back the OpenIM credentials it already minted. Rejects on timeout or if
 * the embedding page never responds — the caller (App.tsx) treats that the
 * same as any other connect failure.
 *
 * `VITE_TRUSTED_PARENT_ORIGIN` scopes which origin's messages this app will
 * accept — unset in local dev (accepts any origin, standard postMessage
 * default), MUST be set to the real portal origin(s) in production so an
 * arbitrary page framing this app can't hand it forged credentials. Framing
 * itself (can this app even be embedded) is a separate concern controlled by
 * this app's own deployment (X-Frame-Options / frame-ancestors), not here.
 */
export function awaitPortalCredentials(): Promise<OpenIMCredentials> {
  const trustedOrigin = import.meta.env.VITE_TRUSTED_PARENT_ORIGIN as string | undefined;

  return new Promise((resolve, reject) => {
    if (window.parent === window) {
      reject(new Error('portal mode requires this app to be embedded in a parent frame'));
      return;
    }

    const timer = window.setTimeout(() => {
      window.removeEventListener('message', handleMessage);
      reject(new Error('timed out waiting for the host page to send OpenIM credentials'));
    }, READY_TIMEOUT_MS);

    function handleMessage(event: MessageEvent) {
      if (trustedOrigin && event.origin !== trustedOrigin) return; // ignore untrusted senders
      if (!isHostCredentialsMessage(event.data)) return;
      window.clearTimeout(timer);
      window.removeEventListener('message', handleMessage);
      resolve({
        openimUserID: event.data.openimUserID,
        token: event.data.token,
        expireTimeSeconds: event.data.expireTimeSeconds ?? 0,
      });
    }

    window.addEventListener('message', handleMessage);
    // Announce readiness AFTER the listener is attached — otherwise a host
    // that posts immediately on iframe `load` can race ahead of us.
    window.parent.postMessage({ source: CHAT_MESSAGE_SOURCE, type: 'ready' }, trustedOrigin || '*');
  });
}
