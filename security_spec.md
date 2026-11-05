# Security Specification (`security_spec.md`)

## 1. Data Invariants
1. **Global Default Deny**: Any path not explicitly matched under `/databases/{database}/documents` is unconditionally denied (`allow read, write: if false;`).
2. **Authentication & Verified Email**: All mutations (`create`, `update`, `delete`) require an authenticated user (`request.auth != null`) with a verified email (`request.auth.token.email_verified == true`) or bootstrapped admin (`sanzhiroz@gmail.com` with `email_verified == true`).
3. **Path Variable Hardening**: Every single-document operation (`get`, `create`, `update`, `delete`) validates `isValidId(logId)` matching `^[a-zA-Z0-9_\-]+$` and `size() <= 128`.
4. **Schema & Volumetric Enforcement (`isValidMedicalLog`)**:
   - Strict `hasAll` and `hasOnly` key allowlist on `create` (21 required keys, zero shadow/ghost fields allowed).
   - `authorUid` must match `request.auth.uid` on `create` and remain immutable on `update`.
   - `id` must match the document `logId` and remain immutable on `update`.
   - `visibility` must equal `'node_doi_yao'`.
   - Every string field has explicit `.size()` bounds and regex checks where applicable (`serviceUnitCode` matches `^[0-9]{5}$`, `date` matches `^[0-9]{4}-[0-9]{2}-[0-9]{2}$`).
   - Every numeric count (`generalPractice`, `chronicCare`, `homeVisit`, `medicalCert`, `specialProcedure`) is validated as `int` or `number` within `[0, 10000]`.
   - Temporal integrity: `createdAt == request.time` on `create`, `createdAt == existing().createdAt` and `updatedAt == request.time` on `update`.
5. **Query Enforcer on `list`**: `allow list` verifies `isSignedIn() && resource.data.visibility == 'node_doi_yao'` so all queries must constrain `where('visibility', '==', 'node_doi_yao')`.

## 2. The "Dirty Dozen" Payloads
1. **Unauthenticated Write**: `auth = null` attempting `create` on `/medical_logs/log-1` -> `PERMISSION_DENIED`.
2. **Unverified Email Write**: `auth = { uid: 'u1', token: { email: 'user@example.com', email_verified: false } }` attempting `create` -> `PERMISSION_DENIED`.
3. **Admin Email Spoof without Verification**: `auth = { uid: 'u2', token: { email: 'sanzhiroz@gmail.com', email_verified: false } }` attempting `delete` -> `PERMISSION_DENIED`.
4. **Identity Spoofing (`authorUid` mismatch)**: `auth.uid = 'u1'` creating document with `authorUid: 'u2'` -> `PERMISSION_DENIED`.
5. **Shadow / Ghost Field Injection on Create**: Payload containing all required fields plus `isAdmin: true` -> `PERMISSION_DENIED`.
6. **Shadow / Ghost Field Injection on Update**: Update modifying `notes` plus adding `ghostField: 'x'` -> `PERMISSION_DENIED`.
7. **Immutable Field Mutation (`createdAt` or `authorUid`)**: Update attempting to change `createdAt` or `authorUid` -> `PERMISSION_DENIED`.
8. **Client Timestamp Forgery**: Create payload with `createdAt` set to a past/future timestamp instead of `request.time` -> `PERMISSION_DENIED`.
9. **Path ID Poisoning**: Creating document with ID > 128 chars or invalid characters -> `PERMISSION_DENIED`.
10. **Value Poisoning on Update (Oversized String)**: Updating `notes` with a string of length 2000 (> 1000 limit) -> `PERMISSION_DENIED`.
11. **Negative Patient Count Injection**: Creating or updating `generalPractice: -5` -> `PERMISSION_DENIED`.
12. **Unconstrained List Query**: Listing `/medical_logs` without `resource.data.visibility == 'node_doi_yao'` or while unauthenticated -> `PERMISSION_DENIED`.
