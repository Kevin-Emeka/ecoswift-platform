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
  // Explicit `family: 4` (IPv4-only), not ioredis's dual-stack default of
  // `family: 0`. On Railway's private network (`*.railway.internal`),
  // dual-stack lookup racing both A and AAAA records has been observed to
  // pick a black-holed IPv6 route for some services and hang until
  // `connectTimeout` instead of falling back to the working IPv4 address —
  // surfacing as a slow ETIMEDOUT with no way to tell the two routes apart
  // from the error alone. Forcing IPv4 sidesteps the race entirely; the
  // private network resolves an A record for every internal hostname, so
  // this doesn't lose reachability anywhere it previously worked.
  const family = 4;

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
