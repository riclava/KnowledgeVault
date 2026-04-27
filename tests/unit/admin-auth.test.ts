import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { AdminAccessError, assertAdminCurrentLearner } from "@/server/admin/admin-auth";

const baseCurrent = {
  learner: {
    id: "learner_1",
    email: "admin@example.com",
    displayName: "Admin",
    role: "learner" as const,
  },
  anonymous: false,
  authSession: null,
  authUser: {
    id: "auth_1",
    email: "admin@example.com",
    name: "Admin",
    learnerId: "learner_1",
  },
};

describe("admin authorization", () => {
  it("accepts admin learners", () => {
    const admin = assertAdminCurrentLearner({
      ...baseCurrent,
      learner: { ...baseCurrent.learner, role: "admin" },
    });

    assert.deepEqual(admin, {
      id: "learner_1",
      email: "admin@example.com",
      displayName: "Admin",
      role: "admin",
    });
  });

  it("rejects regular learners with a typed access error", () => {
    assert.throws(
      () => assertAdminCurrentLearner(baseCurrent),
      (error) =>
        error instanceof AdminAccessError &&
        error.status === 403 &&
        error.message === "需要管理员权限。",
    );
  });
});
