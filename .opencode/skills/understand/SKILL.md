---
name: understand
description: Analyze a codebase to produce an interactive knowledge graph for understanding architecture, components, and relationships
license: MIT
compatibility: opencode
metadata:
  author: Lum1104
  version: "1.0.4"
  tags: codebase,analysis,knowledge-graph,architecture
---

# understand

Analyze the current codebase and produce a `knowledge-graph.json` file in `.understand-anything/`. This file powers the interactive dashboard for exploring the project's architecture.

## Options

- `$ARGUMENTS` may contain:
  - `--full` — Force a full rebuild, ignoring any existing graph
  - A directory path — Scope analysis to a specific subdirectory

---

## Phase 0 — Pre-flight

Determine whether to run a full analysis or incremental update.

1. Set `PROJECT_ROOT` to the current working directory.
2. Get the current git commit hash:
   ```bash
   git rev-parse HEAD
   ```
3. Create the intermediate output directory:
   ```bash
   mkdir -p $PROJECT_ROOT/.understand-anything/intermediate
   ```
4. Check if `$PROJECT_ROOT/.understand-anything/knowledge-graph.json` exists. If it does, read it.
5. Check if `$PROJECT_ROOT/.understand-anything/meta.json` exists. If it does, read it to get `gitCommitHash`.
6. **Decision logic:**

   | Condition | Action |
   |---|---|
   | `--full` flag in `$ARGUMENTS` | Full analysis (all phases) |
   | No existing graph or meta | Full analysis (all phases) |
   | Existing graph + unchanged commit hash | Report "Graph is up to date" and STOP |
   | Existing graph + changed files | Incremental update (re-analyze changed files only) |

   For incremental updates, get the changed file list:
   ```bash
   git diff <lastCommitHash>..HEAD --name-only
   ```
   If this returns no files, report "Graph is up to date" and STOP.

---

## Phase 1 — SCAN (Full analysis only)

Perform the following project scanning task. You may delegate to a subagent (e.g., `@general`) if available, or perform inline.

**Task:** Scan this project directory to discover all source files, detect languages and frameworks.
- Project root: `$PROJECT_ROOT`
- Write output to: `$PROJECT_ROOT/.understand-anything/intermediate/scan-result.json`

**Scanning procedure:**

### Step 1 — Discover source files
Run `git ls-files` to get all tracked files. If this fails (not a git repo), fall back to `find . -type f` with appropriate exclusions.

### Step 2 — Exclude non-source paths
Filter out ALL of the following:
- **Dependency directories:** `node_modules/`, `.git/`, `vendor/`, `venv/`, `.venv/`
- **Build output:** `dist/`, `build/`, `out/`, `coverage/`, `.next/`, `.cache/`, `.turbo/`
- **Lock files:** `*.lock`, `package-lock.json`, `yarn.lock`, `pnpm-lock.yaml`
- **Binary/asset files:** images (`.png`, `.jpg`, `.svg`, `.ico`), fonts (`.woff`, `.ttf`), compiled assets
- **Generated files:** `*.min.js`, `*.map`, `*.d.ts`, `*.generated.*`

### Step 3 — Detect languages and frameworks
- Map file extensions to language IDs (ts/tsx→typescript, js/jsx→javascript, py→python, go→go, rs→rust, java→java, etc.)
- Read `package.json`, `tsconfig.json`, `Cargo.toml`, `go.mod`, `requirements.txt` to detect frameworks
- Read project description from `package.json` `description` or first 10 lines of `README.md`

### Step 4 — Write scan-result.json
Write the following structure to `$PROJECT_ROOT/.understand-anything/intermediate/scan-result.json`:
```json
{
  "name": "project-name",
  "description": "...",
  "languages": ["typescript"],
  "frameworks": ["React"],
  "files": [{"path": "src/index.ts", "language": "typescript", "sizeLines": 150}],
  "totalFiles": 42,
  "estimatedComplexity": "moderate"
}
```
(`estimatedComplexity`: `small` 1-20 files, `moderate` 21-100, `large` 101-500, `very-large` >500)

After the scan completes, read `$PROJECT_ROOT/.understand-anything/intermediate/scan-result.json` to get:
- Project name, description, languages, frameworks
- File list with line counts
- Complexity estimate

**Gate check:** If >200 files, inform the user and suggest scoping with a subdirectory argument. Proceed only if user confirms or add guidance that this may take a while.

---

## Phase 2 — ANALYZE

### Full analysis path

Batch the file list from Phase 1 into groups of **5-10 files each** (aim for balanced batch sizes).

For each batch, perform the following file analysis task (run up to 3 batches concurrently if subagents are available, otherwise process sequentially):

**Task per batch:** Analyze these source files and produce GraphNode and GraphEdge objects.
- Project root: `$PROJECT_ROOT`
- Project: `<projectName>`
- Languages: `<languages>`
- Batch index: `<batchIndex>`
- Write output to: `$PROJECT_ROOT/.understand-anything/intermediate/batch-<batchIndex>.json`

**Analysis procedure per file:**
1. Read the file contents
2. Extract functions/methods (name, line range, parameters), classes/interfaces/types, exports, imports
3. Write a 1-2 sentence summary of the file's purpose
4. Assign complexity: `simple`, `moderate`, or `complex`
5. Assign tags (e.g., `entry-point`, `utility`, `api-handler`, `data-model`)
6. Resolve relative imports to absolute paths using the full project file list

**Output format for each batch** (`batch-<N>.json`):
```json
{
  "nodes": [
    {
      "id": "file:src/index.ts",
      "type": "file",
      "name": "index.ts",
      "filePath": "src/index.ts",
      "summary": "...",
      "tags": ["entry-point"],
      "complexity": "simple"
    }
  ],
  "edges": [
    {"source": "file:src/index.ts", "target": "file:src/utils.ts", "type": "imports", "direction": "outgoing", "weight": 0.7}
  ]
}
```

After ALL batches complete, read each `batch-<N>.json` file and merge:
- Combine all `nodes` arrays. If duplicate node IDs exist, keep the later occurrence.
- Combine all `edges` arrays. Deduplicate by the composite key `source + target + type`.

### Incremental update path

Use the changed files list from Phase 0. Batch and analyze only changed files using the same process above.

After batches complete, merge with the existing graph:
1. Remove old nodes whose `filePath` matches any changed file
2. Remove old edges whose `source` or `target` references a removed node
3. Add new nodes and edges from the fresh analysis

---

## Phase 3 — ASSEMBLE

Merge all file-analyzer results into a single set of nodes and edges. Then perform basic integrity cleanup:

- Remove any edge whose `source` or `target` references a node ID that does not exist in the merged node set
- Remove duplicate node IDs (keep the last occurrence)
- Log any removed edges or nodes for the final summary

---

## Phase 4 — ARCHITECTURE

Perform the following architecture analysis task (delegating to a subagent if available):

**Task:** Analyze this codebase's structure to identify architectural layers.
- Project root: `$PROJECT_ROOT`
- Write output to: `$PROJECT_ROOT/.understand-anything/intermediate/layers.json`

**Architecture analysis procedure:**
1. Examine file paths for directory patterns (routes/→API, services/→Business Logic, db/→Data, components/→UI, utils/→Utility)
2. Use file summaries and tags to infer responsibilities
3. Follow import edges to understand layer dependencies
4. Assign each file to 1 of 3-7 logical layers

**Output format** (`layers.json`):
```json
{
  "layers": [
    {
      "id": "layer:api",
      "name": "API Layer",
      "description": "HTTP endpoints and request/response handling",
      "nodeIds": ["file:src/routes/index.ts"]
    }
  ]
}
```

After the analysis completes, read `$PROJECT_ROOT/.understand-anything/intermediate/layers.json`.

**For incremental updates:** Always re-run architecture analysis on the full merged node set.

---

## Phase 5 — TOUR

Perform the following tour building task (delegating to a subagent if available):

**Task:** Create a guided learning tour for this codebase.
- Project root: `$PROJECT_ROOT`
- Write output to: `$PROJECT_ROOT/.understand-anything/intermediate/tour.json`

**Tour building procedure:**
1. Find entry points (files named `index.ts`, `main.ts`, `app.ts`, `server.ts`, etc.)
2. Trace the dependency flow from entry points outward
3. Group related nodes into 5-15 pedagogical steps
4. Order steps: overview → types/models → core features → infrastructure → advanced

**Output format** (`tour.json`):
```json
{
  "steps": [
    {
      "order": 1,
      "title": "Entry Point",
      "description": "...",
      "nodeIds": ["file:src/index.ts"],
      "languageLesson": "..."
    }
  ]
}
```

---

## Phase 6 — REVIEW

Assemble the full KnowledgeGraph JSON object:

```json
{
  "version": "1.0.0",
  "project": {
    "name": "<projectName>",
    "languages": ["<languages>"],
    "frameworks": ["<frameworks>"],
    "description": "<projectDescription>",
    "analyzedAt": "<ISO 8601 timestamp>",
    "gitCommitHash": "<commit hash from Phase 0>"
  },
  "nodes": [<all merged nodes from Phase 3>],
  "edges": [<all merged edges from Phase 3>],
  "layers": [<layers from Phase 4>],
  "tour": [<steps from Phase 5>]
}
```

1. Write the assembled graph to `$PROJECT_ROOT/.understand-anything/intermediate/assembled-graph.json`.

2. Validate the graph for correctness (delegating to a subagent if available):
   - Read the assembled graph
   - Verify every node has: `id`, `type`, `name`, `summary`, `tags[]`, `complexity`
   - Verify every edge has: `source`, `target`, `type`, `direction`, `weight`
   - Verify `source`/`target` in every edge references a real node ID
   - Write a validation report to `$PROJECT_ROOT/.understand-anything/intermediate/review.json`:
     ```json
     {
       "approved": true,
       "issues": [],
       "warnings": []
     }
     ```

3. After validation:
   - Review the `issues` list
   - Apply automated fixes:
     - Remove edges with dangling references
     - Fill missing required fields with sensible defaults (`tags: []` → `["untagged"]`, missing `summary` → `"No summary available"`)
     - Remove nodes with invalid types
   - If critical issues remain after one fix attempt, save the graph anyway but include warnings in the final report

---

## Phase 7 — SAVE

1. Write the final knowledge graph to `$PROJECT_ROOT/.understand-anything/knowledge-graph.json`.

2. Write metadata to `$PROJECT_ROOT/.understand-anything/meta.json`:
   ```json
   {
     "lastAnalyzedAt": "<ISO 8601 timestamp>",
     "gitCommitHash": "<commit hash>",
     "version": "1.0.0",
     "analyzedFiles": <number of files analyzed>
   }
   ```

3. Clean up intermediate files:
   ```bash
   rm -rf $PROJECT_ROOT/.understand-anything/intermediate
   ```

4. Report a summary to the user containing:
   - Project name and description
   - Files analyzed / total files
   - Nodes created (broken down by type: file, function, class)
   - Edges created (broken down by type)
   - Layers identified (with names)
   - Tour steps generated (count)
   - Any warnings from the review
   - Path to the output file: `$PROJECT_ROOT/.understand-anything/knowledge-graph.json`

---

## Error Handling

- If any task fails, retry **once** with additional context about the failure.
- If it fails a second time, skip that phase and continue with partial results.
- ALWAYS save partial results — a partial graph is better than no graph.
- Report any skipped phases or errors in the final summary so the user knows what happened.
- NEVER silently drop errors. Every failure must be visible in the final report.

---

## Reference: KnowledgeGraph Schema

### Node Types
| Type | Description | ID Convention |
|---|---|---|
| `file` | Source file | `file:<relative-path>` |
| `function` | Function or method | `func:<relative-path>:<name>` |
| `class` | Class, interface, or type | `class:<relative-path>:<name>` |
| `module` | Logical module or package | `module:<name>` |
| `concept` | Abstract concept or pattern | `concept:<name>` |

### Edge Types (18 total)
| Category | Types |
|---|---|
| Structural | `imports`, `exports`, `contains`, `inherits`, `implements` |
| Behavioral | `calls`, `subscribes`, `publishes`, `middleware` |
| Data flow | `reads_from`, `writes_to`, `transforms`, `validates` |
| Dependencies | `depends_on`, `tested_by`, `configures` |
| Semantic | `related`, `similar_to` |

### Edge Weight Conventions
| Edge Type | Weight |
|---|---|
| `contains` | 1.0 |
| `inherits`, `implements` | 0.9 |
| `calls`, `exports` | 0.8 |
| `imports` | 0.7 |
| `depends_on` | 0.6 |
| `tested_by` | 0.5 |
| All others | 0.5 (default) |
