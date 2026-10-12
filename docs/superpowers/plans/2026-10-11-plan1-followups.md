# Plan 1 follow-ups (deferred review findings)

Carried from the Plan 1 review ledger. Fix the first item as the first commit of Plan 2; triage the rest when the touching code is next changed.

## Residual from final review
- grpcWebFetch cleanup() drops caller-abort forwarding after headers on deadline-bearing unary calls (body stall uncancellable) — Ruling: real, deferred to Plan 2 first commit (no second fix wave allowed; no consumer of gRPC-Web unary yet) — cost: until fixed, a stalled gRPC-Web body after headers can't be aborted
- grpcWebFetch sync baseFetch throw unmapped; setTimeout overflow >24.8d; resolveGrpcOrigin logs each render on invalid URL — Ruling: low, deferred

## Deferred minors
- Task 1: minor (deferred): transportMode evaluated at import time (plan-mandated); @types/jest pinned exact vs ~ for jest
- Task 2: minor (deferred): no .gitattributes eol=lf for src/generated/** and protos/** (Windows CRLF churn on regen)
- Task 2: minor (deferred): @protobuf-ts/* saved as ^2.11.1 not exact; plugin bump could cause CI drift failure
- Task 2: minor (deferred): proto-gen shell:true triggers DEP0190 warning on Windows (plan-mandated)
- Task 2: minor (deferred): unrelated reflow of jest.testPathIgnorePatterns in package.json
- Task 3: minor (deferred): problemDetails {"errors":[null]} throws -> unhandled rejection, no toast (old code showed generic toast); fix filter non-object entries (plan-mandated code)
- Task 3: minor (deferred): connection-error string duplicated in ToastProvider vs connectionApiError
- Task 4: minor (deferred): UNAUTHENTICATED from LegalService classifies refreshAndRetry (spec wording "outside AuthService"); anonymous calls should never see it
- Task 4: minor (deferred): Login check depends on method.name ("Login") not localName — document at consumer
- Task 4: minor (deferred): no test for mixed valid/invalid errors-bin entries; traceId key present as undefined
- Task 5: minor (deferred): host values interpolated into XML unescaped
- Task 5: minor (deferred): disabling dev CA without prebuild --clean leaves old cert/XML/manifest attr (README should say --clean when disabling)
- Task 5: minor (deferred): skip warning prints on every config evaluation; does not say which input is missing; skip path/mods untested
- Task 6: minor (deferred): getOrPut not atomic -> possible leaked ManagedChannel (use computeIfAbsent)
- Task 6: minor (deferred): client-side codec/metadata errors reported UNAVAILABLE (-> connectionError toast); INTERNAL more accurate (plan-mandated)
- Task 6: minor (deferred): URL scheme ignored in channelFor (http silently TLS:443)
- Task 6: minor (deferred): exceptions after call creation (start/sendMessage/halfClose) escape and leak calls entry
- Task 6: minor (deferred): early-failure onStreamClose may fire before startServerStream returns — T7 registers listeners before start (already does)
- Task 6: minor (deferred): second unary response overwrites first; OnDestroy cancel triggers events during teardown
- Task 6: minor (deferred): unary OK with null responseBase64 must be error in JS (T7 handles)
- Task 6: minor (deferred): cancelledIds tombstone leak for cancels after completion; registration after call.start can re-insert a closed call; cancel between unlock and sendMessage can throw IllegalStateException (unary would reject -> JS maps to UNAVAILABLE); OnDestroy clears without lock
- Task 7: minor (deferred): abort listeners never removed ({once:true}/remove on settle); OK+null payload RpcError code "OK" should be INTERNAL; sync throw from startServerStream/toBinary leaks listeners; bridge rejection message "Error: x"; lint warning unused `_` in test drain loop (plan-mandated); test gaps (sync early close, Date timeout)
- Task 7: minor (deferred): pre-aborted stream test doesn't consume responses
- Task 8: minor (deferred): gRPC-Web test covers anonymous call only (no authorization header assertion on fetch path); Headers polyfill typed any; mockExpoFetch not reset
- Task 9: minor (deferred): unauthenticated check after first failed call, not before (REST short-circuits; plan-mandated); refresh success doesn't reset failure counter (REST does); test gaps (sync invoke throw, onConsentMissing on retry, onSuccess not on failure)
- Task 10: minor (deferred): startup mode log repeats on origin change; no provider test for Rest no-op / rebuild on origin change
- Task 11: minor (deferred): AGENTS.md Project Structure not updated with src/api, src/config, modules/, protos/, src/generated

## Pending owner verification (Task 12)
- Full APK build (needs Windows long paths or a shorter repo path), Rest regression checklist, Grpc and GrpcWeb smoke tests per plan Task 12.
