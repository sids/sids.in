# Expected errors and defects are separate failure channels

Sid established that handling the only expected error, `StaticAssetFetchError`, with `Effect.catchTag` leaves the Effect's expected-error channel as `never`. Unexpected defects, such as a function throwing inside the pipeline, are not represented by that channel and can still escape when the program is run.
