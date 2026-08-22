// Copyright © 2026 Brocent Cloud Service. All rights reserved.
// SPDX-License-Identifier: GPL-3.0-only
//
// Upstream packaging bug workaround: @openim/client-sdk's ES build imports
// { PullOrder } from "@openim/protocol/lib/pb/sdkws/sdkws", but @openim/protocol
// v0.0.7 only ships a .d.ts at that path — no runtime JS — so Rollup fails to
// resolve it. The enum IS exported at the package root inside the SdkWsProto
// namespace (verified: SdkWsProto.PullOrder = {PullOrderAsc:0, PullOrderDesc:1}),
// so vite.config.ts aliases the broken subpath to this shim. Remove once
// upstream ships runtime JS for the subpath (check on every SDK upgrade).
import { SdkWsProto } from '@openim/protocol';

export const PullOrder = SdkWsProto.PullOrder;
