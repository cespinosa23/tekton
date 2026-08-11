// Detects which deployment this build is running in, purely from where the
// browser loaded it from — no build-time config to keep in sync across
// DEPLOY.md/STAGING.md's separate `npm run build` steps.
export function getEnvironment() {
  const host = window.location.hostname
  if (host === 'app.tekton.energy') return 'production'
  if (host === '209.74.82.224') return 'staging'
  return 'local'
}

export const isProduction = () => getEnvironment() === 'production'
