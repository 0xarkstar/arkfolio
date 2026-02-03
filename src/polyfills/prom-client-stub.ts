/**
 * Browser stub for prom-client (Prometheus metrics)
 *
 * prom-client is a Node.js-only package used by pd-aio-sdk for monitoring.
 * This stub provides no-op implementations for browser environments.
 */

// No-op metric classes
class NoOpMetric {
  inc() {}
  dec() {}
  set() {}
  observe() {}
  reset() {}
  remove() {}
  labels() { return this; }
}

export class Counter extends NoOpMetric {}
export class Gauge extends NoOpMetric {}
export class Histogram extends NoOpMetric {}
export class Summary extends NoOpMetric {}

export class Registry {
  metrics() { return ''; }
  getMetricsAsJSON() { return []; }
  registerMetric() {}
  clear() {}
  resetMetrics() {}
  setDefaultLabels() {}
  get contentType() { return 'text/plain'; }
}

export function collectDefaultMetrics() {}
export function register() {}

export default {
  Counter,
  Gauge,
  Histogram,
  Summary,
  Registry,
  collectDefaultMetrics,
  register,
};
