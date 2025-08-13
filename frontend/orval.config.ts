import { defineConfig } from 'orval';

export default defineConfig({
  shopgauge: {
    input: {
      target: process.env.OPENAPI_URL || 'http://localhost:8080/v3/api-docs',
    },
    output: {
      target: 'src/generated/shopgauge-client.ts',
      client: 'react-query',
      prettier: true,
      override: {
        mutator: {
          path: 'src/api.ts',
          name: 'api',
        },
        fetch: { includeHttpResponseReturnType: false },
        query: {
          useQuery: true,
          useInfinite: true,
          signal: true,
        },
      },
    },
  },
});
