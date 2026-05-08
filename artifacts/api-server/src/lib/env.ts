// Environment variable validation
// Note: DATABASE_URL may be set by Vercel but is not used in this Firestore-only app

export const validateEnv = () => {
  const port = process.env["PORT"];
  
  if (!port) {
    throw new Error(
      "PORT environment variable is required but was not provided.",
    );
  }

  if (Number.isNaN(Number(port)) || Number(port) <= 0) {
    throw new Error(`Invalid PORT value: "${port}"`);
  }

  // DATABASE_URL might be set by Vercel but we don't use it
  // This prevents build errors when DATABASE_URL is present
  if (process.env.DATABASE_URL) {
    console.warn("⚠️  DATABASE_URL is set but not used - this app uses Firestore");
  }
};
