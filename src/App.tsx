// Copyright © 2026 Brocent Cloud Service. All rights reserved.
// SPDX-License-Identifier: GPL-3.0-only
//
// Entry logic: pick a mode from the URL, exchange credentials via one of the
// two allowed backend endpoints, connect the OpenIM bridge, resolve the group,
// render the conversation. The "Source code" footer link is this app's GPL
// corresponding-source offer — do not remove it.
import React, { useEffect, useRef, useState } from 'react';
import { Alert, Layout, Spin, Typography } from 'antd';
import { exchangeDeviceToken, exchangeSessionToken } from './backendApi';
import {
  type ChatMessage, type ConnectionState, connect, findLatestSupportGroupID,
} from './openim';
import ChatView from './ChatView';
import { t } from './i18n';

const { Text, Link } = Typography;

const SOURCE_URL = 'https://github.com/jackzhang2026/Chat-Integration';

// Same-origin by default: nginx serves this app and proxies both the OpenIM
// API/WS and the host /api under one hostname. Overridable per deployment.
const OPENIM_API_ADDR = (import.meta.env.VITE_OPENIM_API as string | undefined) ?? `${window.location.origin}/openim-api`;
const OPENIM_WS_ADDR = (import.meta.env.VITE_OPENIM_WS as string | undefined)
  ?? `${window.location.origin.replace(/^http/, 'ws')}/openim-ws`;

type Phase = 'boot' | 'ready' | 'error';

const App: React.FC = () => {
  const [phase, setPhase] = useState<Phase>('boot');
  const [connectionState, setConnectionState] = useState<ConnectionState>('connecting');
  const [groupID, setGroupID] = useState<string | null>(null);
  const [incoming, setIncoming] = useState<ChatMessage[]>([]);
  const [deviceToken, setDeviceToken] = useState<string | undefined>(undefined);
  const bootedRef = useRef(false);

  useEffect(() => {
    if (bootedRef.current) return; // React StrictMode double-invoke guard
    bootedRef.current = true;

    const params = new URLSearchParams(window.location.search);
    const deviceToken = params.get('t');
    const staffGroup = params.get('group');
    if (deviceToken) setDeviceToken(deviceToken);  // device mode → enables chat-to-ticket

    (async () => {
      try {
        const creds = deviceToken
          ? await exchangeDeviceToken(deviceToken)
          : await exchangeSessionToken();

        await connect({
          userID: creds.openimUserID,
          token: creds.token,
          apiAddr: OPENIM_API_ADDR,
          wsAddr: OPENIM_WS_ADDR,
          onStateChange: setConnectionState,
          onNewMessages: (msgs) => setIncoming(msgs),
        });

        const resolvedGroup = staffGroup ?? (await findLatestSupportGroupID());
        if (!resolvedGroup) throw new Error('no support conversation found');
        setGroupID(resolvedGroup);
        setPhase('ready');
      } catch {
        setPhase('error');
      }
    })();
  }, []);

  return (
    <Layout style={{ height: '100vh', background: '#fff' }}>
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
        {/* Brand v1.3 (wordmark-only): the trust promise renders before any
            conversation content — security is the first thing a customer reads. */}
        <div style={{
          background: '#081c33', color: 'rgba(255,255,255,0.72)', fontSize: 11.5,
          textAlign: 'center', padding: '5px 10px', letterSpacing: '0.04em', flexShrink: 0,
        }}
        >
          🔒 {t('trustBar')}
        </div>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8, padding: '10px 16px',
          borderBottom: '1px solid #f0f0f0', flexShrink: 0,
        }}
        >
          <span style={{ fontWeight: 800, letterSpacing: '0.03em', fontSize: 15, color: '#262626' }}>
            <span style={{ color: '#1890ff' }}>BCS</span> Beam{' '}
            <span style={{ fontWeight: 500, color: '#8c8c8c' }}>{t('brandSupport')}</span>
          </span>
          {phase === 'ready' && connectionState === 'connected' && (
            <span style={{
              marginLeft: 'auto', fontSize: 12, color: '#8c8c8c',
              display: 'inline-flex', alignItems: 'center', gap: 6,
            }}
            >
              <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#52c41a' }} />
              {t('connected')}
            </span>
          )}
        </div>
        <div style={{ flex: 1, minHeight: 0 }}>
          {phase === 'boot' && (
            <div style={{
              height: '100%', display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center', gap: 12,
            }}
            >
              <Spin size="large" />
              <Text strong>{t('connecting')}</Text>
              <Text type="secondary" style={{ fontSize: 12 }}>{t('connectingHint')}</Text>
            </div>
          )}
          {phase === 'error' && (
            <div style={{ padding: 24 }}>
              <Alert type="error" message={t('connectFailed')} showIcon />
            </div>
          )}
          {phase === 'ready' && groupID && (
            <ChatView
              groupID={groupID}
              connectionState={connectionState}
              incoming={incoming}
              deviceToken={deviceToken}
            />
          )}
        </div>
        <div style={{
          textAlign: 'center', padding: '4px 0', fontSize: 11, flexShrink: 0,
          borderTop: '1px solid #f0f0f0',
        }}
        >
          <Link href={SOURCE_URL} target="_blank" rel="noopener" style={{ fontSize: 11 }}>
            {t('sourceCode')}
          </Link>
        </div>
      </div>
    </Layout>
  );
};

export default App;
