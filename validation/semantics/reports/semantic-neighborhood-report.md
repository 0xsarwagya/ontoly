# Semantic Neighborhood Report

Alpha.19 introduces deterministic semantic neighborhoods as a derived artifact.

Neighborhoods are generated for every Software Graph node and group related nodes by:

- direct graph relationships
- shared feature ownership
- shared intent vocabulary
- shared domain vocabulary

The output is stored in `.ontoly/enhancers/artifacts/semantics.json` under `neighborhoods`.
