// Copyright © 2026 Brocent Cloud Service. All rights reserved.
// SPDX-License-Identifier: GPL-3.0-only
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // Served under /support-chat/ behind the host nginx (see the host system's
  // support-intake redirect); relative base keeps assets resolving there.
  base: './',
  resolve: {
    alias: {
      // Upstream packaging bug — see src/shims/openim-protocol-sdkws.ts
      '@openim/protocol/lib/pb/sdkws/sdkws': '/src/shims/openim-protocol-sdkws.ts',
    },
  },
  server: {
    port: 5174,
  },
});
