# Data Model

## 1. Persistence principles

PostgreSQL is the transactional source of truth. Sequelize provides the object-relational mapping between application models and database tables.

The main business entity is an issue report. A report is associated with the user who submitted it and can carry evidence metadata, operational status, and resolution information.

## 2. Core entities

### User

Conceptual fields:

| Field | Purpose |
|---|---|
| `id` | Stable user identifier |
| `name` | Display name |
| `email` | Login identity; must be unique |
| `password` | Password hash only |
| `role` | `citizen`, `staff`, or `admin` |
| timestamps | Account lifecycle metadata |

Security rule: password material must never be returned in API payloads or written to logs.

### Issue

Conceptual fields include:

| Field | Purpose |
|---|---|
| `id` | Issue UUID |
| `title` | Short problem description |
| `description` | Detailed citizen report |
| `latitude` | Reported geographic latitude |
| `longitude` | Reported geographic longitude |
| `address` | Reverse-geocoded human-readable location |
| `photo_url` | Original evidence reference |
| `resolution_photo_url` | Resolution evidence reference |
| `status` | `Open`, `In Progress`, `Resolved` |
| `needs_review` | Manual-review signal |
| `phash` | Perceptual hash used for similarity checks |
| `user_id` | Submitting user relationship |
| timestamps | Created/updated lifecycle |

Exact field names and constraints must be confirmed against the current Sequelize model before schema migrations or external consumers are generated.

## 3. Status semantics

`status` is an operational workflow state:

```text
Open
In Progress
Resolved
```

It is not equivalent to:

- verified authenticity;
- fraud confirmed;
- physical work completed;
- policy violation.

`needs_review` is a separate signal and should not be overloaded into the status field.

## 4. Evidence metadata

### Original evidence

The original issue image is processed for:

- file type and size;
- EXIF presence/significance;
- timestamp availability;
- photo age;
- embedded GPS;
- distance from reported coordinates;
- perceptual similarity.

### Resolution evidence

Staff/admin can provide resolution imagery. The original and resolution evidence should remain logically distinct so audit history is not obscured by overwriting the citizen's submission.

## 5. Ownership and authorization

Expected ownership boundaries:

```text
Citizen -> owns/submits own reports
Staff   -> operationally manages reports
Admin   -> administrative override/deletion privileges
```

The current issue router enforces staff/admin roles for updates and admin-only authorization for deletion. fileciteturn258file0L2-L6

## 6. Data integrity expectations

- User email should be unique.
- Issue IDs must be valid UUIDs at the API boundary.
- Latitude/longitude must satisfy geographic ranges.
- Status must be from the supported enum.
- Hash fields should only contain valid values produced by the server-side hash implementation.
- Evidence URLs should not be accepted as unrestricted arbitrary server-side filesystem paths.

## 7. Indexing and scale

As issue volume grows, review query patterns for:

- status filtering;
- created-at sorting;
- user ownership;
- review queues;
- perceptual hash comparison;
- geospatial lookup.

The current pHash implementation reads existing non-null hashes and performs similarity calculation in application code, which is acceptable for a small dataset but becomes a scaling bottleneck as the number of images increases. fileciteturn263file0L2-L2

## 8. Migration policy

Production schema evolution should use reviewed, versioned migrations rather than implicit runtime synchronization. The existing deployment documentation identifies the current lack of a mature migration runner as a production caveat. fileciteturn255file0L2-L2

Migration requirements:

1. Additive changes first where backward compatibility matters.
2. Avoid destructive changes in the same release as code that still depends on the old schema.
3. Record rollback feasibility.
4. Test against a representative PostgreSQL instance.
5. Update Data Model documentation whenever a persisted field, relationship, enum, or index changes.

## 9. Retention and deletion

Deletion semantics must distinguish:

- business deletion of an issue;
- deletion of original/resolution files;
- audit/history retention;
- database backup retention.

A delete endpoint being available does not by itself prove that data has been erased from backups or external storage. The privacy and disaster-recovery documents define those boundaries.
