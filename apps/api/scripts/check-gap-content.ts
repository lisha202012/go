/**
 * CI / deploy gate — fails if GAP placeholder copy would ship to a client-visible environment.
 * Run with NODE_ENV=production or GOFAM_DEPLOY_ENV=staging|demo|production.
 */
import { exitOnGapPlaceholderContent } from '../src/lib/gapContentGuard';

exitOnGapPlaceholderContent();
console.log('GAP content guard: OK (not placeholder, or non-client environment)');
