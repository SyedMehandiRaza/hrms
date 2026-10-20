# 01: Contract schema changes

**What to build:** The additive column and enum changes on the eight contract tables only, plus the contract-type
foreign key on contracts becoming RESTRICT (plan decision 46),
plus model attributes and seed data (plan section 5). No other table changes.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

Roles: "HR" = the owner or a sub-admin with the named `contract` flag.

- [ ] When the migrations run on a fresh database and on one with the existing seed → they succeed, and undoing
      them restores the previous schema.
- [ ] When a contract is saved with status REVOKED, a revoke reason (≤ 500), revoked time and revoker → it is stored.
- [ ] When a contract is saved with rate, rate unit, currency and notice period → they are stored; with no currency
      → it defaults to SAR.
- [ ] When a second SENT, VIEWED or SUBMITTED contract with the same type and recipient is saved in one company →
      the database refuses it.
- [ ] When the other contract is DRAFT, COMPLETED, REJECTED, EXPIRED, REVOKED or deleted → the new active one is accepted.
- [ ] When a contract type used by a contract is removed at database level → the database refuses it.
- [ ] When a document is saved with a 64-character file hash → it is stored.
- [ ] When a template is saved with a contract type → it is stored; when that type is then removed at database
      level → the database refuses it.
- [ ] When template or contract fields are saved with type DATE or INITIALS or merge source CONTRACT → they are stored.
- [ ] When a recipient is saved with a 500-character reject reason, signed IP, user agent and evidence → they are stored.
- [ ] When an activity is saved with action REVOKED → it is stored.
- [ ] When two contract types with the same name are saved in one company → the database refuses it; in two
      companies → both are stored.
- [ ] When the migrations run on a database with existing templates → each employee template gets the company's EMP
      type and each staffing template its STAFF type where those exist; others stay without a type.
- [ ] When the seed runs → types EXT and AMD exist; the seeded document has a real PDF file in private storage
      whose hash, page count and size are stored; there is an ACTIVE employee template (type EMP, with a required
      SIGNATURE, a DATE and the `employee_name` and `designation` merge fields) and an ACTIVE staffing template
      (type STAFF).
- [ ] When the seed runs → the shared activity seeder file is unchanged; undoing the contract seeder restores the
      seeded document and template to how they were.
