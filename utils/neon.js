function readNeonServiceConfig() {
  return {
    auth: {
      applicationName: process.env.NEON_AUTH_APPLICATION_NAME || '',
      baseUrl: process.env.NEON_AUTH_BASE_URL || '',
      jwksUrl: process.env.NEON_AUTH_JWKS_URL || '',
    },
    storage: {
      endpoint: process.env.AWS_ENDPOINT_URL_S3 || '',
      region: process.env.AWS_REGION || '',
      hasCredentials: Boolean(
        process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY,
      ),
    },
    aiGateway: {
      baseUrl: process.env.NEON_AI_GATEWAY_BASE_URL || '',
      hasToken: Boolean(process.env.NEON_AI_GATEWAY_TOKEN),
    },
  };
}

module.exports = { readNeonServiceConfig };
