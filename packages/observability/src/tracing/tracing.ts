import { NodeSDK } from '@opentelemetry/sdk-node';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { Resource } from '@opentelemetry/resources';
import { ATTR_SERVICE_NAME, ATTR_SERVICE_VERSION } from '@opentelemetry/semantic-conventions';

let sdk: NodeSDK | undefined;

/**
 * Bootstraps OpenTelemetry auto-instrumentation (HTTP, Express, and — once
 * added to a service — Prisma/ioredis instrumentation packages, picked up
 * automatically by `getNodeAutoInstrumentations()`). **Must be called
 * before any other import that touches an instrumented module** — in
 * practice, the very first line of `main.ts`, before `NestFactory` is even
 * imported, which is why this isn't wired through Nest's DI the way the
 * rest of `@ecoswift/observability` is.
 *
 * No-ops when `OTEL_ENABLED` isn't `true` (the default) — auto-instrumenting
 * every module has real startup-time and per-request overhead that local
 * dev shouldn't pay for by default.
 *
 * Exports via OTLP HTTP — vendor-neutral, works against Jaeger, Grafana
 * Tempo, or any other OTLP-compatible collector (see docs/observability.md
 * § OpenTelemetry).
 */
export function startTracing(serviceName: string): void {
  if (process.env.OTEL_ENABLED !== 'true') {
    return;
  }

  sdk = new NodeSDK({
    resource: new Resource({
      [ATTR_SERVICE_NAME]: process.env.OTEL_SERVICE_NAME ?? serviceName,
      [ATTR_SERVICE_VERSION]: process.env.npm_package_version ?? '0.0.0',
    }),
    traceExporter: new OTLPTraceExporter({
      url: process.env.OTEL_EXPORTER_OTLP_ENDPOINT ?? 'http://localhost:4318/v1/traces',
    }),
    instrumentations: [getNodeAutoInstrumentations()],
  });

  sdk.start();

  process.on('SIGTERM', () => {
    void sdk?.shutdown();
  });
}

export async function stopTracing(): Promise<void> {
  await sdk?.shutdown();
}
