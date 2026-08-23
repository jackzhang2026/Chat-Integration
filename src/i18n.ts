// Copyright © 2026 Brocent Cloud Service. All rights reserved.
// SPDX-License-Identifier: GPL-3.0-only
//
// Deliberately tiny dictionary-based i18n — this app must stay dependency-light
// and must NOT import the host system's locale files (see README: zero imports).

const dictionaries = {
  en: {
    connecting: 'Connecting…',
    connected: 'Connected',
    reconnecting: 'Connection lost — reconnecting…',
    connectFailed: 'Could not connect to chat. Please close this window and try again.',
    inputPlaceholder: 'Type a message…',
    send: 'Send',
    waitingForAgent: 'You are connected. A support engineer will join shortly.',
    agentJoined: 'Support engineer joined the conversation.',
    sourceCode: 'Source code',
    todayLabel: 'Today',
    sendFailed: 'Message failed to send — tap to retry.',
    loadEarlier: 'Load earlier messages',
    emptyState: 'No messages yet. Describe your issue below to get started.',
    createTicket: 'Create ticket',
    ticketModalTitle: 'Create a support ticket',
    ticketDescPlaceholder: 'Describe the problem — this becomes the ticket description.',
    ticketSubmit: 'Create',
    ticketCancel: 'Cancel',
    ticketCreated: 'Ticket created',
    ticketExisting: 'This conversation already has an open ticket',
    ticketFailed: 'Could not create the ticket — please try again.',
    ticketAnnounce: 'A support ticket has been created for this conversation:',
  },
  zh: {
    connecting: '连接中…',
    connected: '已连接',
    reconnecting: '连接中断——正在重连…',
    connectFailed: '无法连接聊天服务，请关闭窗口后重试。',
    inputPlaceholder: '输入消息…',
    send: '发送',
    waitingForAgent: '已连接。支持工程师将很快加入对话。',
    agentJoined: '支持工程师已加入对话。',
    sourceCode: '源代码',
    todayLabel: '今天',
    sendFailed: '消息发送失败——点击重试。',
    loadEarlier: '加载更早的消息',
    emptyState: '还没有消息。在下方描述您的问题即可开始。',
    createTicket: '创建工单',
    ticketModalTitle: '创建支持工单',
    ticketDescPlaceholder: '描述您遇到的问题——这将成为工单描述。',
    ticketSubmit: '创建',
    ticketCancel: '取消',
    ticketCreated: '工单已创建',
    ticketExisting: '本次会话已有进行中的工单',
    ticketFailed: '工单创建失败，请重试。',
    ticketAnnounce: '已为本次会话创建支持工单：',
  },
} as const;

export type MessageKey = keyof (typeof dictionaries)['en'];

const lang: keyof typeof dictionaries = navigator.language.toLowerCase().startsWith('zh') ? 'zh' : 'en';

export const t = (key: MessageKey): string => dictionaries[lang][key];
