import { defineConfig } from 'drizzle-kit'

// Configuration for Drizzle Kit schema migrations
export default defineConfig({
  schema: './src/db/schema.ts',
  out: './src/db/migrations',
  dialect: 'postgresql',
})
