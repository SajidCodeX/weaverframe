const fs = require('fs')

;['src/lib/auth.ts', 'src/lib/admin.ts', 'src/lib/dashboard.ts'].forEach(f => {
  let code = fs.readFileSync(f, 'utf8')
  code = code.replace(/\.validator\(/g, '.inputValidator(')
  fs.writeFileSync(f, code)
})

console.log('Fixed inputValidator')
