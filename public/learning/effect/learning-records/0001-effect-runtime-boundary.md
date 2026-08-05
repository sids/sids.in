# The Effect runtime belongs at the application boundary

Sid established that `Effect.runPromise` belongs at the top level of the Worker-facing `fetch` handler because that is where the composed Effect program must satisfy Cloudflare's `Promise<Response>` contract. This means leaf functions should continue returning Effects so their errors and requirements remain composable until the boundary.
