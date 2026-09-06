# Performance and Scalability

## 1. Performance objective

Performance work should optimize the complete user journey rather than a single endpoint in isolation.

Primary measurements:

- API request latency;
- upload processing latency;
- database query latency;
- geocoding latency;
- pHash computation time;
- admin list/query latency;
- mobile submission completion time.

## 2. Percentiles

Use p50, p95, and p99 rather than averages alone. Tail latency is important because evidence processing and external geocoding can create outlier requests.

## 3. Current bottlenecks

The current issue creation path performs several synchronous operations including reverse geocoding, EXIF processing, and pHash similarity checks before persistence. The controller also loads existing non-null pHashes for similarity evaluation, which creates an application-level scaling cost as image volume increases. fileciteturn263file0L2-L2

## 4. Scaling path

### Stage 1 — small deployment

```text
single API
single PostgreSQL
local uploads
process-local limiter
```

### Stage 2 — multi-instance API

```text
load balancer
  |
  +--> API instance
  +--> API instance
  +--> API instance
        |
        +--> shared PostgreSQL
        +--> durable object storage
        +--> Redis/shared rate limiter
```

### Stage 3 — asynchronous evidence processing

```text
API -> create pending issue -> queue
                                |
                                v
                     evidence workers
                                |
                                +--> EXIF
                                +--> image validation
                                +--> pHash
                                +--> geocoding
                                |
                                v
                         update issue
```

## 5. Benchmark discipline

Every benchmark should record:

```text
commit SHA
dataset size
request mix
concurrency
CPU / memory
Node version
database version
storage backend
external dependency behavior
p50 / p95 / p99
throughput
failure rate
```

Do not use synthetic benchmark numbers as production capacity claims.

## 6. Load-test priorities

1. `GET /api/issues` list reads.
2. `GET /api/issues/:id` detail reads.
3. authenticated issue creation without image.
4. authenticated issue creation with image.
5. concurrent uploads.
6. status updates.
7. admin filtering.
8. database connection saturation.
9. rate-limit behavior.

## 7. Performance safeguards

- Cap request body sizes.
- Limit upload size and count.
- Use database indexes for observed query patterns.
- Cache safe geocoding responses where terms permit.
- Avoid N+1 database queries.
- Move expensive evidence work off the request path at higher scale.
- Use shared infrastructure primitives when scaling horizontally.

The current API configures body limits, upload limits, and rate limiting as baseline protection. fileciteturn257file0L2-L5
