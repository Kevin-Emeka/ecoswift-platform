import Redis, { type Cluster, type RedisOptions } from 'ioredis';

export interface RedisClientConfig {
  url: string;
  clusterEnabled: boolean;
  clusterNodes?: string;
  tlsEnabled: boolean;
}

/**
 * Creates a single-node `Redis` client or a `Redis.Cluster` client from the
 * same config shape, so application code depends on the common subset of
 * the ioredis API and never has to branch on deployment topology itself.
 *
 * Local dev / most services: single-node (`REDIS_URL`).
 * Production at scale: Cluster mode (`REDIS_CLUSTER_ENABLED=true` +
 * `REDIS_CLUSTER_NODES=host1:6379,host2:6379,host3:6379`) — see
 * docs/infrastructure.md § Redis Cluster for the topology this targets.
 */
export function createRedisClient(config: RedisClientConfig): Redis | Cluster {
  const tls = config.tlsEnabled ? {} : undefined;
  // `family: 0` tells Node's DNS resolution to return both A and AAAA
  // records and connect to whichever answers (Happy Eyeballs), instead of
  // ioredis's default `family: 4` (IPv4-only). Several hosting platforms'
  // private networks — Railway's `*.railway.internal` among them — only
  // publish AAAA (IPv6) records, so a hardcoded IPv4-only lookup fails
  // immediately with no usable address, which surfaces as a fast
  // MaxRetriesPerRequestError with no underlying DNS/connection log line
  // to explain it. Harmless everywhere else, since dual-stack lookup still
  // finds an IPv4 address when that's all that exists (local dev, most
  // other Redis hosts).
  const family = 0;

  if (config.clusterEnabled) {
    if (!config.clusterNodes) {
      throw new Error('REDIS_CLUSTER_NODES is required when REDIS_CLUSTER_ENABLED=true');
    }

    const nodes = config.clusterNodes.split(',').map((entry) => {
      const [host, port] = entry.trim().split(':');
      return { host, port: Number(port) };
    });

    return new Redis.Cluster(nodes, {
      redisOptions: { tls, family },
      // Cluster reads/writes should degrade to a live replica rather than
      // fail outright when a master shard is momentarily unreachable.
      scaleReads: 'slave',
      clusterRetryStrategy: (times) => Math.min(times * 200, 2000),
    });
  }

  const options: RedisOptions = {
    tls,
    family,
    maxRetriesPerRequest: 3,
    retryStrategy: (times) => Math.min(times * 200, 2000),
  };

  const client = new Redis(config.url, options);

  // ioredis never surfaces the underlying connection failure (ECONNREFUSED /
  // ENOTFOUND / auth rejection / etc.) anywhere by default — callers only
  // ever see the generic MaxRetriesPerRequestError once retries are
  // exhausted, with no way to tell *why* every attempt failed. Logging the
  // client's own 'error' event to stderr (unconditionally — this fires
  // before any app logger is necessarily wired up) makes that root cause
  // visible in the deploy logs instead of guesswork.
  client.on('error', (err) => {
    // eslint-disable-next-line no-console
    console.error('[redis] connection error:', err?.message ?? err);
  });

  return client;
}
