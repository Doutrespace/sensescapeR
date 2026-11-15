/**
 * Extends app.json. The only dynamic part is the web base path: a GitHub
 * Pages project site is served from /<repository-name>/, so the web build
 * needs that prefix. Set WEB_BASE_PATH when building for such a host, e.g.
 *
 *   WEB_BASE_PATH=/soundscape-app npm run build:web
 *
 * Leave it unset for local development or a site served from the root.
 */
module.exports = ({ config }) => {
  const basePath = (process.env.WEB_BASE_PATH || '').replace(/\/+$/, '');

  return {
    ...config,
    web: {
      ...config.web,
      bundler: 'metro',
      // Single-page app: all routing happens in the browser.
      output: 'single',
    },
    experiments: {
      ...(config.experiments || {}),
      ...(basePath ? { baseUrl: basePath } : {}),
    },
  };
};
