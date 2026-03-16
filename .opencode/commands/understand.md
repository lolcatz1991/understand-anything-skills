---
description: Analyze a codebase to produce an interactive knowledge graph for understanding architecture, components, and relationships
---

Load the `understand` skill and execute it with arguments: $ARGUMENTS

The understand skill analyzes this codebase and produces a `.understand-anything/knowledge-graph.json` file. It runs a multi-phase pipeline: scanning files, analyzing code structure, identifying architecture layers, building a guided tour, and saving results.

Pass `--full` to force a full rebuild, or a directory path to scope the analysis.
