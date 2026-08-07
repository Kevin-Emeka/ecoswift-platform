# Logging

Every app/service emits structured JSON logs via Pino (`nestjs-pino`),
tagged with a correlation id (see `CorrelationIdMiddleware`). In
development, logs are pretty-printed via `pino-pretty`; in
staging/production they stay raw JSON for ingestion by a log
aggregator (e.g. Loki, CloudWatch, Datadog).

This folder holds shared log-shipping configuration (log driver options,
vector/promtail/fluent-bit config) — introduced when a real aggregator is
provisioned. `docker-compose.yml` currently uses the default `json-file`
Docker log driver for local development.
