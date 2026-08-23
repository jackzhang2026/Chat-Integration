// Copyright © 2026 Brocent Cloud Service. All rights reserved.
// SPDX-License-Identifier: GPL-3.0-only
//
// Thin bridge over @openim/client-sdk: login, one conversation's history,
// send text, live incoming messages. Everything the UI needs and nothing more.

import { getSDK, CbEvents } from '@openim/client-sdk';
import type { MessageItem } from '@openim/client-sdk';

export type ConnectionState = 'connecting' | 'connected' | 'reconnecting' | 'failed';

export interface ChatMessage {
  clientMsgID: string;
  sendID: string;
  senderNickname: string;
  content: string;
  sendTime: number;
  isSelf: boolean;
}

/** A support group (customer intake / device chat) or a direct 1:1 peer
 * (TASK-059 P1.5 ⑤: staff messaging a customer/vendor contact directly). */
export type ChatTarget =
  | { kind: 'group'; groupID: string }
  | { kind: 'peer'; userID: string };

const sdk = getSDK();

let selfUserID = '';

const textOf = (m: MessageItem): string => {
  try {
    // contentType 101 (text) carries {"content": "..."} — same shape the server
    // REST API uses. Anything else renders as an empty string for now (files
    // and rich types come later with the host's design pass).
    const parsed = JSON.parse(m.content ?? '');
    return typeof parsed?.content === 'string' ? parsed.content : '';
  } catch {
    return typeof (m as { textElem?: { content?: string } }).textElem?.content === 'string'
      ? (m as unknown as { textElem: { content: string } }).textElem.content
      : String(m.content ?? '');
  }
};

const toChatMessage = (m: MessageItem): ChatMessage => ({
  clientMsgID: m.clientMsgID,
  sendID: m.sendID,
  senderNickname: m.senderNickname || m.sendID,
  content: textOf(m),
  sendTime: m.sendTime,
  isSelf: m.sendID === selfUserID,
});

export interface LoginOptions {
  userID: string;
  token: string;
  apiAddr: string;
  wsAddr: string;
  onStateChange: (state: ConnectionState) => void;
  onNewMessages: (messages: ChatMessage[]) => void;
}

export async function connect(opts: LoginOptions): Promise<void> {
  selfUserID = opts.userID;

  sdk.on(CbEvents.OnConnecting, () => opts.onStateChange('connecting'));
  sdk.on(CbEvents.OnConnectSuccess, () => opts.onStateChange('connected'));
  sdk.on(CbEvents.OnConnectFailed, () => opts.onStateChange('failed'));

  sdk.on(CbEvents.OnRecvNewMessages, ({ data }) => {
    const items = (data as MessageItem[]) ?? [];
    if (items.length) opts.onNewMessages(items.map(toChatMessage));
  });
  sdk.on(CbEvents.OnRecvNewMessage, ({ data }) => {
    const item = data as MessageItem;
    if (item) opts.onNewMessages([toChatMessage(item)]);
  });

  await sdk.login({
    userID: opts.userID,
    token: opts.token,
    apiAddr: opts.apiAddr,
    wsAddr: opts.wsAddr,
    platformID: 5, // Web
  });
}

/** OpenIM derives super-group conversation ids as sg_<groupID> and 1:1
 * ("single") conversation ids as si_<lower>_<higher> (lexicographically
 * sorted user ids) — ported verbatim from the server's own
 * pkg/util/conversationutil.GenConversationIDForSingle /
 * GenGroupConversationID (openim-src, v3.8.3-patch.15) rather than guessed,
 * since getting this wrong means silently reading/writing the wrong
 * conversation. */
export const conversationIdForGroup = (groupID: string): string => `sg_${groupID}`;
export const conversationIdForPeer = (peerUserID: string): string =>
  `si_${[selfUserID, peerUserID].sort().join('_')}`;

const conversationIdFor = (target: ChatTarget): string => (
  target.kind === 'group' ? conversationIdForGroup(target.groupID) : conversationIdForPeer(target.userID)
);

export async function loadHistory(target: ChatTarget, beforeClientMsgID = ''): Promise<ChatMessage[]> {
  const { data } = await sdk.getAdvancedHistoryMessageList({
    conversationID: conversationIdFor(target),
    count: 40,
    startClientMsgID: beforeClientMsgID,
  });
  const list = (data as { messageList?: MessageItem[] })?.messageList ?? [];
  return list.map(toChatMessage);
}

export async function sendText(target: ChatTarget, text: string): Promise<ChatMessage> {
  const created = await sdk.createTextMessage(text);
  const message = created.data as MessageItem;
  // SDK convention: exactly one of recvID/groupID is non-empty per send.
  if (target.kind === 'group') {
    await sdk.sendMessage({ recvID: '', groupID: target.groupID, message });
  } else {
    await sdk.sendMessage({ recvID: target.userID, groupID: '', message });
  }
  return toChatMessage(message);
}

/** Device mode has no group id in the URL — the device user's newest
 * support_* group IS its live conversation (deterministic ids, see the host's
 * openim_bridge.services.support_group_id). */
export async function findLatestSupportGroupID(): Promise<string | null> {
  const { data } = await sdk.getJoinedGroupListPage({ offset: 0, count: 100 });
  const groups = (data as { groupID: string; createTime?: number }[]) ?? [];
  const support = groups
    .filter((g) => g.groupID.startsWith('support_'))
    .sort((a, b) => (b.createTime ?? 0) - (a.createTime ?? 0));
  return support[0]?.groupID ?? null;
}

export async function disconnect(): Promise<void> {
  try {
    await sdk.logout();
  } catch {
    // closing anyway
  }
}
