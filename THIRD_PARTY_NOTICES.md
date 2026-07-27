# Third-Party Notices

Ontoly is distributed under the GNU Affero General Public License version 3.0.
Commercial licenses are available separately from the creator. See
[COMMERCIAL_LICENSE.md](COMMERCIAL_LICENSE.md).

The repository depends on open-source packages managed through `pnpm-lock.yaml`.
Primary development dependencies include TypeScript, Vitest, tsup, and Node.js
type definitions. Runtime package dependencies are declared in each publishable
package manifest.

## License Compatibility

Ontoly's release gates verify package metadata and local license files with:

```sh
pnpm license:check
pnpm validate:packages
pnpm validate:pack
```

Dependencies remain subject to their own license terms. If a future dependency
introduces a stronger copyleft license, an incompatible license, or a NOTICE
requirement, maintainers must update this file before release.

## Generated Artifacts

Generated Software Graphs, Semantics artifacts, validation reports, and Agent
Skill installation outputs may contain repository metadata owned by the analyzed
project. Do not publish generated artifacts from private repositories unless
they are sanitized and you have permission to share them.
