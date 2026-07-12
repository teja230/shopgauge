# Test Suite Summary

StoreSight maintains separate frontend and backend suites. CI runs the deterministic frontend suite,
the complete backend suite, lint, formatting checks, and both production builds.

## Current verified totals

- Frontend maintained suite: **846 passing cases across 9 files**
- Backend complete suite: **767 passing cases**
- Combined verified cases: **1,613**

Counts reflect independently reported Vitest cases and JUnit test or parameterized-test invocations.
The behavior matrices use distinct inputs and expected outcomes rather than repeated assertions.

## Enforced frontend coverage

CI enforces an 80% minimum for statements, branches, functions, and lines across the maintained
production-core scope. The latest verified report is:

- Statements: **90.25%**
- Branches: **85.05%**
- Functions: **96.15%**
- Lines: **90.25%**

The scoped production modules are pricing validation, admin navigation state, keyboard navigation,
merchant-question intent classification, date/device/dimension helpers, Shopify-domain
normalization, and application-shell routing. Large legacy dashboard and administration pages are
not represented by this percentage; they require component-harness migration before they can join
the enforced scope without publishing a misleading whole-repository number.

## Frontend coverage areas

- Shopify domain normalization: bare names, full domains, URL variants, casing, paths, and malformed identifiers
- Merchant question classification: cost, competitor, revenue, product, order, recommendation, and summary intents
- Browser and device parsing: Chrome, Firefox, Safari, Edge, Opera, Android, iPhone, and iPad variants
- Application-shell routing boundaries
- Date and responsive-dimension boundaries
- API security: credentials, CSRF headers, correlation IDs, and transient retry behavior
- Admin navigation state and keyboard interaction
- Business-intelligence transformation and display behavior
- Pricing-validation interaction

## Backend coverage areas

- Competitor URL SSRF and transport validation
- Shopify domain and label validation matrices
- Text sanitization boundaries
- Shopify webhook HMAC verification and exact-body mutation rejection
- Shopify GraphQL mapping, authentication headers, error handling, and pagination metadata
- OAuth state and callback security
- Tenant authorization and session fingerprinting
- Alert formatting and delivery behavior
- Cache, session synchronization, SSE, monitoring, discovery, and cost optimization services

## Commands

```bash
# Deterministic frontend CI suite
npm run test:ci

# Frontend coverage report
npm run test:coverage

# Complete backend suite
./gradlew clean test

# Full backend verification
./gradlew clean test spotlessCheck build
```

Coverage artifacts are generated under `frontend/coverage/` and are excluded from version control.
