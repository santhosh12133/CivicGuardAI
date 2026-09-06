# Architecture Diagrams

The following Mermaid diagrams are intended to render in GitHub and documentation tooling that supports Mermaid.

## System context

```mermaid
flowchart LR
    Citizen[Citizen Mobile]
    Admin[Admin Portal]
    API[CivicFix API]
    DB[(PostgreSQL)]
    Files[(Upload Storage)]
    Geo[Reverse Geocoding Provider]

    Citizen -->|HTTPS / JSON / multipart| API
    Admin -->|HTTPS / JSON / multipart| API
    API --> DB
    API --> Files
    API --> Geo
```

## Issue submission sequence

```mermaid
sequenceDiagram
    participant C as Citizen App
    participant A as API
    participant G as Geocoder
    participant E as Evidence Pipeline
    participant D as PostgreSQL

    C->>A: POST /api/issues + JWT + image
    A->>A: Validate JWT and request fields
    A->>E: Validate image / EXIF / GPS / pHash
    A->>G: Reverse geocode coordinates
    G-->>A: Address / fallback
    E-->>A: Validation + review signal
    A->>D: Persist issue
    D-->>A: Issue record
    A-->>C: 201 Created
```

## Issue lifecycle

```mermaid
stateDiagram-v2
    [*] --> Open
    Open --> InProgress
    InProgress --> Resolved
    Open --> Resolved
```

The API can also accept a valid status directly for authorized staff/admin update requests; the state diagram represents the normal business progression rather than an exhaustive constraint on the current API.

## Evidence pipeline

```mermaid
flowchart TD
    Upload[Image Upload]
    Type[Type + Size Validation]
    EXIF[EXIF Inspection]
    Date[Timestamp Validation]
    GPS[GPS Validation]
    Geo[Reverse Geocoding]
    Hash[pHash]
    Review[Review Signal]
    Persist[Persist Issue]

    Upload --> Type --> EXIF --> Date --> GPS
    GPS --> Geo
    GPS --> Hash
    Hash --> Review
    Review --> Persist
    Geo --> Persist
```

## Trust boundaries

```mermaid
flowchart LR
    U[Untrusted Mobile / Browser]
    B[API Boundary]
    T[Trusted Domain Logic]
    P[(PostgreSQL)]
    S[(File / Object Storage)]
    X[External Provider]

    U -->|Untrusted input| B
    B --> T
    T --> P
    T --> S
    T --> X
```

## Target deployment

```mermaid
flowchart LR
    M[Expo / EAS Mobile]
    W[Vite Admin / Vercel]
    L[HTTPS Load Balancer]
    A[Node / Express API]
    D[(Managed PostgreSQL)]
    O[(Durable Object Storage)]
    R[(Redis Shared Limiter)]
    G[Geocoder]

    M --> L
    W --> L
    L --> A
    A --> D
    A --> O
    A --> R
    A --> G
```

The durable object storage and shared Redis nodes are target architecture elements for scaled production; the current repository still documents local uploads and process-local rate limiting as transitional limitations. fileciteturn255file0L2-L2
