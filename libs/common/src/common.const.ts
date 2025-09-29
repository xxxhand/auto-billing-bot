export const DEFAULT_MONGO = Symbol.for('DefaultMongooseClient');
export const DEFAULT_TRANSLATE = Symbol.for('DefaultTranslateService');
export const DEFAULT_HTTP_CLIENT = Symbol.for('DefaultHttpClient');
export const DEFAULT_REDIS = Symbol.for('DefaultRedisClient');
export const X_TRACE_ID = 'x-trace-id';
export enum usedHttpHeaders {
  X_TRACE_ID = 'x-trace-id',
  ACCEPT_LANG = 'Accept-Language',
}
