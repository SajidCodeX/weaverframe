const fs = require('fs')

let code = fs.readFileSync('src/lib/dashboard.ts', 'utf8')

// Add import
code = code.replace(
  "import { getDb } from './db'",
  "import { getDb } from './db'\nimport { getTenantDb } from './auth'"
)

// Replace all getDb() with getTenantDb()
code = code.replace(/getDb\(\)/g, 'getTenantDb()')

fs.writeFileSync('src/lib/dashboard.ts', code)
console.log('Successfully updated dashboard.ts to use getTenantDb')
