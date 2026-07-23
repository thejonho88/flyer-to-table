// Wraps app.json so CI can inject a base path when deploying under a
// subdirectory (e.g. GitHub Pages serves at /flyer-to-table/).
module.exports = ({ config }) => ({
  ...config,
  experiments: {
    ...config.experiments,
    ...(process.env.EXPO_BASE_URL ? { baseUrl: process.env.EXPO_BASE_URL } : {}),
  },
});
