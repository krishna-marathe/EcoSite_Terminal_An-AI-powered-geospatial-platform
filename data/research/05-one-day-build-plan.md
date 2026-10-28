# One-Day EcoSite Ministry Prototype Plan

## Outcome

A polished, locally runnable end-to-end prototype for publicly disclosed data
centres in Maharashtra, Telangana, Karnataka and Tamil Nadu. It will demonstrate
the public registry, restricted operator registration, ministry review,
environmental context and new-site planning with explicit provenance.

Current priority decision: build the public operational-facility registry and
dashboard first. Detailed operator-registration requirements are deferred until
the public-data experience is working.

## Product flows

### Public dashboard

- Four-state map with locality-level facility markers
- Only currently operational facilities; pipeline projects remain excluded
- State, city, operator, ownership, type and lifecycle filters
- Capacity and public sustainability summaries without invented values
- Facility profile with source links, publication dates and confidence
- Unknown/private/unverified values displayed honestly
- Environmental context and official-source status

### Operator registration

- Deferred behind the public-dashboard milestone
- Demo operator identity for the prototype
- Facility identity, ownership, lifecycle and capacity form
- Exact map point and optional campus polygon
- Public source/evidence links
- Draft and submission workflow
- Exact geometry and contact data remain restricted
- Submitted record cannot publish itself

### Ministry review

- Demo ministry-reviewer identity for the prototype
- Submission queue and record comparison
- Duplicate and missing-evidence warnings
- Approve, request information or reject
- Choose approved public fields
- Generate separate locality-level public geometry
- Publish immutable approved snapshot
- Audit event history

### New-site planning

- Create project and candidate polygon
- Four-state and India-boundary validation
- Environmental observations already supported by the backend
- Hard-constraint, power, water, biodiversity, community and hazard sections
- Evidence coverage and missing-data explanations
- "Recommended for detailed review", never automatic government approval
- Site passport suitable for demonstration/export

## Backend work

- Resolve the current database revision mismatch before feature development
- Add registration, review, public-snapshot and audit tables through Alembic
- Define strict Pydantic request/response contracts
- Add public facility and ministry summary endpoints
- Add private operator registration endpoints
- Add ministry review endpoints
- Never return restricted geometry through public serializers
- Seed a reviewable demonstration submission separately from public records

## Frontend work

- Restructure the landing page into a ministry/public registry dashboard
- Add public facility map and filterable registry table
- Add facility profile and provenance panel
- Add operator registration wizard with map selection
- Add ministry review queue and review detail
- Integrate existing site-planning components where stable
- Add loading, empty, error and restricted-data states
- Preserve the existing EcoSite dark visual identity

## Research/data work

- Build a small four-state facility inventory only from traceable public sources
- Require explicit evidence that each published facility is currently operational
- Store a 90-day operational-verification expiry and hide stale records publicly
- Record source URL, publisher, retrieval date, disclosed precision and status
- Do not infer undisclosed capacity, water use, PUE, WUE or compliance
- Generalise locations for the public map
- Keep operator declarations separate from public-source facts
- Correct the document-manifest integrity issues already identified

## Verification

- Backend unit/API tests for registration privacy and review transitions
- Explicit test proving public APIs cannot expose restricted geometry/contact data
- Frontend tests for public registry, registration and review flows
- Lint touched files
- Production frontend build
- Backend test suite in the supported Python environment or documented container
- Manual smoke test of the complete submission-to-publication journey

## Security boundary for this prototype

The prototype will use clearly marked local demo roles to show authorization
boundaries. Production government SSO, verified organisation onboarding, MFA,
security accreditation, malware scanning and public deployment remain later
work. The database and API design must make replacing demo roles possible
without redesigning the workflows.

## Suggested work order

1. Repair data and migration integrity.
2. Finalise the prototype operational-facility seed and public data contract.
3. Implement public registry database/API contracts and tests.
4. Build public dashboard and facility profiles.
5. Define and build operator registration and ministry review interfaces.
6. Connect environmental/site-planning features.
7. Run tests, build, smoke test and document the demo.

## Remaining decisions

1. Choose India-map opening view versus a fitted four-state view.
2. Confirm the current EcoSite name and dark visual identity.

Operator minimum-submission fields are intentionally deferred until after the
public registry/dashboard milestone.
