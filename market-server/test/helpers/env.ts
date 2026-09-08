// Test environment setup. MUST be imported before app/prisma (which read
// process.env at module load). dotenv won't override these (default override: false).

process.env.DATABASE_URL = "postgresql://tradeAdmin:tradeAdmin@localhost:5432/trade_test?schema=public";
process.env.JWT_SECRET = "test-secret-key-for-auth-tests-0000000000000000";
process.env.JWT_ISSUER = "market-server";
process.env.JWT_AUDIENCE = "market-client";
process.env.JWT_ACCESS_TOKEN_TTL = "15m";
process.env.JWT_REFRESH_TOKEN_TTL = "168h";
process.env.COOKIE_SECURE = "false";
