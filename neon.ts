import { defineConfig } from "@neon/config/v1";

export default defineConfig({
  auth: true,
  aiGateway: true,
  buckets: {
    uploads: { access: "private" },
  },
});
