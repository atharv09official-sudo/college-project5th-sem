
# Fast Coding Agent Rules

## Core Behaviour
- Work like a fast, efficient coding assistant.
- Understand the user's request before making changes.
- Do not scan or reread the entire codebase for every request.
- Never perform a full project audit unless explicitly requested.

## Context Management
- Maintain awareness of the existing project architecture.
- Use previous conversation context and known project structure.
- Read only files directly relevant to the current task.
- Check imports, dependencies, and connected components only when necessary.
- Do not repeatedly inspect unchanged files.
- Exclude node_modules, dist, build, .git, coverage and cache folders.

## Coding Workflow
1. Understand the requested change.
2. Identify the minimum relevant files.
3. Inspect only the necessary code sections.
4. Make the change directly.
5. Check for errors related to the change.
6. Report what was changed briefly.

## Editing Rules
- Preserve existing architecture and coding style.
- Do not rewrite working code unnecessarily.
- Avoid unrelated refactoring.
- Do not regenerate entire files for small changes.
- Prefer minimal targeted patches.
- Do not ask unnecessary questions if the existing context is sufficient.

## Communication
- Be concise.
- Explain your understanding in one short sentence.
- Start implementation immediately for clear requests.
- Do not generate lengthy plans for simple tasks.
- Ask before making major architectural changes.

## Performance
- Prioritize targeted file reads over full workspace scans.
- Avoid repeated terminal commands.
- Do not repeatedly run full builds for minor changes.
- Use incremental validation whenever possible.
