import { defineConfig } from 'vite';

// The wireframe lives at /draft/. Without the slash Vite's HTML fallback
// would serve the root page instead, so redirect it.
export default defineConfig({
  plugins: [
    {
      name: 'draft-trailing-slash',
      configureServer(server) {
        server.middlewares.use((req, res, next) => {
          if (req.url === '/draft' || req.url?.startsWith('/draft?')) {
            res.statusCode = 301;
            res.setHeader('Location', req.url.replace('/draft', '/draft/'));
            res.end();
            return;
          }
          next();
        });
      },
    },
  ],
});
