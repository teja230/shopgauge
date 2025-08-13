# StoreSight Architecture Overview

This document summarizes the system architecture at a high level.

## Backend
- Spring Boot monolith
- HTTP APIs (OpenAPI via springdoc)
- Spring Data JPA for CRUD; Redis for sessions; Flyway for migrations
- Observability: Micrometer + Actuator + OpenTelemetry
- Resilience: Resilience4j patterns

## Frontend
- React + Vite
- Typed API client via OpenAPI codegen and React Query
- Storybook for UI components

## Data & Compliance
- Audit logging with centralized writer & PII masking
- PII annotations and field-level encryption (AES-GCM) for sensitive fields
- Data retention jobs and DPIA records

See ADRs in `docs/adr/` for major decisions.


