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

/** OpenIM derives super-group conversation ids as sg_<groupID>. */
export const conversationIdForGroup = (groupID: string): string => `sg_${groupID}`;

export async function loadHistory(groupID: string, beforeClientMsgID = ''): Promise<ChatMessage[]> {
  const { data } = await sdk.getAdvancedHistoryMessageList({
    conversationID: conversationIdForGroup(groupID),
    count: 40,
    startClientMsgID: beforeClientMsgID,
  });
  const list = (data as { messageList?: MessageItem[] })?.messageList ?? [];
  return list.map(toChatMessage);
}

export async function sendText(groupID: string, text: string): Promise<ChatMessage> {
  const created = await sdk.createTextMessage(text);
  const message = created.data as MessageItem;
  await sdk.sendMessage({ recvID: '', groupID, message });
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
