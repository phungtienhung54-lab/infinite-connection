// Neon branch configuration (Lakebase Postgres). Docs: https://neon.com/docs/reference/neon-ts.md
import { defineConfig } from "@neon/config/v1";

export default defineConfig({
  // Auth.js already provides auth; do not enable Neon Auth here.
  auth: false,
  // Branch policy: per-branch tuning
  branch: (branch) => {
    if (branch.isDefault) {
      return {};
    }
    if (!branch.exists) {
      return { ttl: "7d" };
    }
    return {};
  },
});
