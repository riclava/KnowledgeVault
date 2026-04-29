import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  hasRequiredPrismaDelegates,
  shouldReusePrismaClient,
} from "@/lib/db/prisma";

describe("Prisma client singleton", () => {
  it("rejects a stale development client missing newly generated delegates", () => {
    assert.equal(
      hasRequiredPrismaDelegates({
        user: {},
        knowledgeItem: {},
      }),
      false,
    );
  });

  it("reuses only clients with the current schema signature and required delegates", () => {
    const client = {
      knowledgeDedupeRun: {},
      knowledgeDedupeCandidate: {},
      adminBulkGenerateImportRun: {},
      adminBulkGenerateImportRow: {},
    };

    assert.equal(
      shouldReusePrismaClient({
        client,
        currentSignature: "current",
        storedSignature: "old",
      }),
      false,
    );
    assert.equal(
      shouldReusePrismaClient({
        client,
        currentSignature: "current",
        storedSignature: "current",
      }),
      true,
    );
  });
});
