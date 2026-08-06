export interface Middleware {
  [key: string]: string
}

/**
 * The application's middleware aliases.
 *
 * Aliases may be used instead of class names to conveniently assign middleware to routes and groups.
 */
export default {
  'maintenance': 'Maintenance',
  'cors': 'Cors',
  'auth': 'Auth',
  'guest': 'Guest',
  'api': 'Api',
  'team': 'Team',
  'logger': 'Logger',
  'abilities': 'Abilities',
  'can': 'Can',
  'throttle': 'Throttle',
  'env': 'Env',
  'env:local': 'EnvLocal',
  'env:development': 'EnvDevelopment',
  'env:dev': 'EnvDevelopment',
  'env:staging': 'EnvStaging',
  'env:production': 'EnvProduction',
  'env:prod': 'EnvProduction',
  'role': 'Role',
  'permission': 'Permission',
  'verified': 'EnsureEmailIsVerified',
  'csrf': 'Csrf',
  'compress': 'Compress',
  // Optional by default; `apikey:required` refuses an unkeyed request.
  // See app/Middleware/ApiKey.ts.
  'apikey': 'ApiKey',
  // Add more middleware aliases here
  // Note: Use ! prefix for negation (e.g., '!auth', '!env:development')
} satisfies Middleware
