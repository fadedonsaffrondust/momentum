// Barrel for the per-domain hook modules. Existing call sites import from
// `@/api/hooks` (or `../api/hooks`) and Vite resolves the directory's
// index.ts — splitting hooks.ts into domain files required no churn at
// the consumer side.
//
// Query-key factories and the apiFetch / useToken / SHARED_STALE_TIME
// helpers are exported from `./_shared` for new callers that want to
// build their own queries.

export * from './_shared';
export * from './auth';
export * from './users';
export * from './settings';
export * from './roles';
export * from './tasks';
export * from './parkings';
export * from './daily-logs';
export * from './stats';
export * from './brands';
export * from './brand-action-items';
export * from './brand-feature-requests';
export * from './brand-sync';
export * from './inbox';
export * from './data';
