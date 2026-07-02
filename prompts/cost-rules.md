# Cost Rules

- Simple requests → intent router + direct tool (no planner, no extra LLM)
- complex_planner only for multi-step or analysis strategy requests
- No embeddings for memory in this phase
- Validator is deterministic unless planner step fails
- Voice: max 350 output tokens, compact context only
