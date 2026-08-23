// Copyright © 2026 Brocent Cloud Service. All rights reserved.
// SPDX-License-Identifier: GPL-3.0-only
//
// The ONLY three host-backend calls this app is allowed to make (see README;
// the third — ticket-from-chat — was approved 2026-08-23). Plain fetch on
// purpose: no shared axios client, no interceptors, no host API map — keeping
// this file the complete, auditable backend surface.

export interface OpenIMCredentials {
  openimUserID: string;
  token: string;
  expireTimeSeconds: number;
}

const API_BASE = (import.meta.env.VITE_API_BASE as string | undefined) ?? '/api';

/** Django sets the csrftoken cookie non-HttpOnly by design; session-authenticated
 * POSTs (staff mode) must echo it. Device mode has no session — header is ignored. */
const csrfToken = (): string => {
  const match = document.cookie.match(/(?:^|;\s*)csrftoken=([^;]+)/);
  return match ? decodeURIComponent(match[1]) : '';
};

const post = async <T,>(path: string, body: unknown): Promise<T> => {
  const resp = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      'X-CSRFToken': csrfToken(),
    },
    body: JSON.stringify(body),
  });
  if (!resp.ok) {
    throw new Error(`backend call failed: HTTP ${resp.status}`);
  }
  return resp.json();
};

/** Anonymous customer on a managed device — authenticated by the signed
 * per-device token baked into the page URL. */
export const exchangeDeviceToken = (deviceToken: string): Promise<OpenIMCredentials> =>
  post<OpenIMCredentials>('/openim/device-token/', { t: deviceToken });

/** Logged-in host identity (staff embedding this app in the workbench). */
export const exchangeSessionToken = (): Promise<OpenIMCredentials> =>
  post<OpenIMCredentials>('/openim/token/', {});

export interface ChatTicketResult {
  ticket_number: string;
  ticket_id: number;
  /** false = this conversation already had an open ticket; that one is returned. */
  created: boolean;
}

/** Turn the current support conversation into a formal ticket. Device mode
 * only — same signed token as the device-token exchange; the backend verifies
 * the conversation belongs to this device and dedups per group. */
export const createTicketFromChat = (
  deviceToken: string, groupID: string, description: string,
): Promise<ChatTicketResult> =>
  post<ChatTicketResult>('/openim/ticket-from-chat/', {
    t: deviceToken, group: groupID, description,
  });
