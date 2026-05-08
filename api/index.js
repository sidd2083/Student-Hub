let _app;
let _initError;

async function getApp() {
  if (_initError) throw _initError;
  if (!_app) {
    try {
      const mod = await import("../artifacts/api-server/dist/handler.mjs");
      _app = mod.default;
    } catch (err) {
      _initError = err;
      throw err;
    }
  }
  return _app;
}

module.exports = async function handler(req, res) {
  try {
    const app = await getApp();
    return app(req, res);
  } catch (err) {
    console.error("[api/index] Failed to initialize app:", err);
    if (!res.headersSent) {
      res.status(503).json({
        error: "Service temporarily unavailable. Please try again later.",
        detail: process.env.NODE_ENV !== "production" ? String(err?.message) : undefined,
      });
    }
  }
};
