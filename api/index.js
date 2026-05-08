let _app;

async function getApp() {
  if (!_app) {
    const mod = await import("../artifacts/api-server/dist/handler.mjs");
    _app = mod.default;
  }
  return _app;
}

module.exports = async function handler(req, res) {
  const app = await getApp();
  return app(req, res);
};
