import { defineVitestProject } from '@nuxt/test-utils/config'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    projects: [
      await defineVitestProject({
        test: {
          name: 'nuxt',
          include: ['tests/nuxt/**/*.test.ts'],
          environment: 'nuxt',
          environmentOptions: {
            nuxt: {
              overrides: {
                runtimeConfig: {
                  public: {
                    supabase: {
                      url: 'http://127.0.0.1:54321',
                      key: 'test-key',
                    },
                  },
                },
              },
            },
          },
        },
      }),
    ],
  },
})
