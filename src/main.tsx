// Copyright © 2026 Brocent Cloud Service. All rights reserved.
// SPDX-License-Identifier: GPL-3.0-only
import React from 'react';
import ReactDOM from 'react-dom/client';
import { ConfigProvider } from 'antd';
import App from './App';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ConfigProvider
      theme={{
        token: {
          colorPrimary: '#1890ff',
          borderRadius: 6,
          controlHeight: 32,
        },
      }}
    >
      <App />
    </ConfigProvider>
  </React.StrictMode>,
);
