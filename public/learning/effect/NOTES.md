# Teaching notes

- Sid learns best by doing and wants the repository migrated slowly.
- Sid chose Effect 4 while it is still in beta; pin exact beta versions and treat each dependency upgrade as a migration requiring full verification.
- Keep all Effect teaching state and artifacts under `public/learning/effect/` so they are available from the local dev server.
- Prefer one production-sized slice per lesson, with a runnable test and an explicit compatibility boundary.
- Do not infer mastery from code being shown; ask for a prediction or explanation before writing a learning record.
- Start with familiar Promise-shaped code. Introduce services, layers, schemas, concurrency, and observability only when the repository supplies a real use case.
