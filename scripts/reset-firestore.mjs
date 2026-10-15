// Wipes bootcamp data from Firestore before a new bootcamp. Uses the Firebase CLI
// (`firebase login` first). Never deletes config/registration (the teacher registration code).
//
//   npm run reset:classes   classes, students, projects, published pages (teachers keep their links)
//   npm run reset:all       all of the above + teacher spaces (teachers create them again with the invite link)
//
// Add -- --yes to skip the confirmation (e.g. npm run reset:classes -- --yes).
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { createInterface } from 'node:readline/promises'

const COLLECTIONS = {
  classes: ['classes', 'projects', 'published'],
  all: ['classes', 'projects', 'published', 'teachers', 'teacherKeys', 'teacherInvites', 'teacherLogins', 'teacherSecrets'],
}

const mode = process.argv[2]
const skipConfirm = process.argv.includes('--yes')
const project = JSON.parse(readFileSync('.firebaserc', 'utf8')).projects.default

if (!COLLECTIONS[mode]) {
  console.log('Usage: npm run reset:classes   or   npm run reset:all')
  process.exit(1)
}

const collections = COLLECTIONS[mode]
console.log(`\nProject: ${project}`)
console.log(`This PERMANENTLY deletes (including subcollections):\n  - ${collections.join('\n  - ')}`)
console.log('Kept: config/registration (teacher registration code).')
if (mode === 'classes') console.log('Teachers keep their personal links.')
else console.log('Teachers will need the invite link again to create their space.')
console.log('Note: deletes count toward the free daily limit (20,000 per day).\n')

if (!skipConfirm) {
  const rl = createInterface({ input: process.stdin, output: process.stdout })
  const answer = await rl.question(`Type the project name (${project}) to confirm: `)
  rl.close()
  if (answer.trim() !== project) {
    console.log('Cancelled. Nothing was deleted.')
    process.exit(1)
  }
}

for (const collection of collections) {
  console.log(`\nDeleting ${collection}…`)
  try {
    execFileSync('firebase', ['firestore:delete', collection, '--recursive', '--force', '--project', project], {
      stdio: 'inherit',
    })
  } catch {
    console.error(`\nCould not delete "${collection}". Is the Firebase CLI installed and are you logged in (firebase login)?`)
    process.exit(1)
  }
}
console.log('\nDone. Firestore is ready for a new bootcamp.')
