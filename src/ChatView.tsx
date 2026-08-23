// Copyright © 2026 Brocent Cloud Service. All rights reserved.
// SPDX-License-Identifier: GPL-3.0-only
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Button, Input, Modal, Spin, Typography, message as antdMessage } from 'antd';
import { FileAddOutlined, SendOutlined } from '@ant-design/icons';
import { createTicketFromChat } from './backendApi';
import { type ChatMessage, type ChatTarget, type ConnectionState, loadHistory, sendText } from './openim';
import { t } from './i18n';

const { Text } = Typography;

// Public-repo note: this repo is intentionally standalone, so the palette is
// declared here from the published AntD5 defaults the host system also uses —
// values, not imports.
const COLOR_PRIMARY = '#1890ff';
const COLOR_TEXT = '#262626';
const COLOR_TEXT_SECONDARY = '#8c8c8c';
const COLOR_BORDER = '#f0f0f0';

interface Props {
  target: ChatTarget;
  connectionState: ConnectionState;
  /** Live messages pushed up from the SDK bridge (App owns the subscription). */
  incoming: ChatMessage[];
  /** Present only in device mode — enables the chat-to-ticket button (the
   * backend re-verifies it and that this conversation belongs to the device).
   * Ticket-from-chat is a support-group concept, so it also requires
   * target.kind === 'group' — a 1:1 staff↔contact chat never offers it. */
  deviceToken?: string;
}

const bubbleStyle = (isSelf: boolean): React.CSSProperties => ({
  maxWidth: '78%',
  padding: '8px 12px',
  borderRadius: 8,
  fontSize: 14,
  lineHeight: 1.5,
  whiteSpace: 'pre-wrap',
  wordBreak: 'break-word',
  alignSelf: isSelf ? 'flex-end' : 'flex-start',
  background: isSelf ? COLOR_PRIMARY : '#f5f5f5',
  color: isSelf ? '#fff' : COLOR_TEXT,
});

const ChatView: React.FC<Props> = ({ target, connectionState, incoming, deviceToken }) => {
  const canTicket = !!deviceToken && target.kind === 'group';
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [failedDraft, setFailedDraft] = useState<string | null>(null);
  const [ticketOpen, setTicketOpen] = useState(false);
  const [ticketDesc, setTicketDesc] = useState('');
  const [ticketBusy, setTicketBusy] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    loadHistory(target)
      .then((history) => {
        if (!cancelled) setMessages(history);
      })
      .finally(() => {
        if (!cancelled) setHistoryLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- target is set once by App and never mutated in place
  }, [target.kind, target.kind === 'group' ? target.groupID : target.userID]);

  useEffect(() => {
    if (!incoming.length) return;
    setMessages((cur) => {
      const seen = new Set(cur.map((m) => m.clientMsgID));
      const fresh = incoming.filter((m) => !seen.has(m.clientMsgID));
      return fresh.length ? [...cur, ...fresh] : cur;
    });
  }, [incoming]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  const doSend = useCallback(async (text: string) => {
    const body = text.trim();
    if (!body || sending) return;
    setSending(true);
    setFailedDraft(null);
    try {
      const sent = await sendText(target, body);
      setMessages((cur) => (cur.some((m) => m.clientMsgID === sent.clientMsgID) ? cur : [...cur, sent]));
      setDraft('');
    } catch {
      setFailedDraft(body);
    } finally {
      setSending(false);
    }
  }, [target, sending]);

  const doCreateTicket = useCallback(async () => {
    const desc = ticketDesc.trim();
    if (!desc || !deviceToken || target.kind !== 'group' || ticketBusy) return;
    setTicketBusy(true);
    try {
      const result = await createTicketFromChat(deviceToken, target.groupID, desc);
      setTicketOpen(false);
      setTicketDesc('');
      if (result.created) {
        antdMessage.success(`${t('ticketCreated')} · ${result.ticket_number}`);
        // Announce in the conversation so the technician side sees the number
        // too; a failed announce must not fail the (already created) ticket.
        try {
          const sent = await sendText(target, `${t('ticketAnnounce')} ${result.ticket_number}`);
          setMessages((cur) => (cur.some((m) => m.clientMsgID === sent.clientMsgID) ? cur : [...cur, sent]));
        } catch { /* ticket exists; announcement is best-effort */ }
      } else {
        antdMessage.info(`${t('ticketExisting')} · ${result.ticket_number}`);
      }
    } catch {
      antdMessage.error(t('ticketFailed'));
    } finally {
      setTicketBusy(false);
    }
  }, [deviceToken, target, ticketDesc, ticketBusy]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
      {connectionState === 'reconnecting' && (
        <Alert banner type="warning" message={t('reconnecting')} />
      )}

      <div style={{
        flex: 1, minHeight: 0, overflowY: 'auto', padding: 16,
        display: 'flex', flexDirection: 'column', gap: 8,
      }}
      >
        {historyLoading ? (
          <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 40 }}><Spin /></div>
        ) : messages.length === 0 ? (
          <Text type="secondary" style={{ textAlign: 'center', paddingTop: 40 }}>
            {t('emptyState')}
          </Text>
        ) : (
          messages.map((m) => (
            <div key={m.clientMsgID} style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {!m.isSelf && (
                <Text style={{ fontSize: 12, color: COLOR_TEXT_SECONDARY, paddingLeft: 4 }}>
                  {m.senderNickname}
                </Text>
              )}
              <div style={bubbleStyle(m.isSelf)}>{m.content}</div>
            </div>
          ))
        )}
        <div ref={bottomRef} />
      </div>

      {failedDraft !== null && (
        <Alert
          banner
          type="error"
          message={t('sendFailed')}
          style={{ cursor: 'pointer' }}
          onClick={() => doSend(failedDraft)}
        />
      )}

      <div style={{
        display: 'flex', gap: 8, padding: 12, borderTop: `1px solid ${COLOR_BORDER}`, flexShrink: 0,
      }}
      >
        {canTicket && (
          <Button
            icon={<FileAddOutlined />}
            onClick={() => setTicketOpen(true)}
            title={t('createTicket')}
          >
            {t('createTicket')}
          </Button>
        )}
        <Input.TextArea
          autoSize={{ minRows: 1, maxRows: 4 }}
          value={draft}
          placeholder={t('inputPlaceholder')}
          disabled={connectionState === 'failed'}
          onChange={(e) => setDraft(e.target.value)}
          onPressEnter={(e) => {
            if (!e.shiftKey) {
              e.preventDefault();
              doSend(draft);
            }
          }}
        />
        <Button
          type="primary"
          icon={<SendOutlined />}
          loading={sending}
          disabled={connectionState === 'failed' || !draft.trim()}
          onClick={() => doSend(draft)}
        >
          {t('send')}
        </Button>
      </div>

      <Modal
        title={t('ticketModalTitle')}
        open={ticketOpen}
        onOk={doCreateTicket}
        onCancel={() => setTicketOpen(false)}
        okText={t('ticketSubmit')}
        cancelText={t('ticketCancel')}
        confirmLoading={ticketBusy}
        okButtonProps={{ disabled: !ticketDesc.trim() }}
      >
        <Input.TextArea
          autoSize={{ minRows: 4, maxRows: 8 }}
          value={ticketDesc}
          placeholder={t('ticketDescPlaceholder')}
          onChange={(e) => setTicketDesc(e.target.value)}
          maxLength={4000}
          showCount
        />
      </Modal>
    </div>
  );
};

export default ChatView;
