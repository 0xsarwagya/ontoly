import { posix } from "node:path";
import type {
  PythonCall,
  PythonClass,
  PythonImport,
  PythonProject,
} from "@0xsarwagya/ontoly-python";

const MAX_REEXPORT_HOPS = 8;
const CLASS_RECEIVERS = new Set(["self", "cls"]);

// A module (name undefined) or a top-level name declared in a source file.
interface Location {
  readonly file: string;
  readonly name?: string | undefined;
}

type ImportBinding = readonly [localName: string, location: Location];

export class PythonNameResolver {
  private readonly fileIds: ReadonlyMap<string, string>;
  private readonly roots: readonly string[];
  private readonly classIds: ReadonlyMap<string, string>;
  private readonly callableIds: ReadonlyMap<string, string>;
  private readonly methodClassNames: ReadonlyMap<string, string>;
  private readonly bindings: ReadonlyMap<string, Location>;

  constructor(project: PythonProject) {
    this.fileIds = new Map(project.files.map((file) => [file.file, file.id]));
    this.roots = sourceRoots(new Set(this.fileIds.keys()));
    this.classIds = idsByLocation(project.classes);
    this.callableIds = idsByLocation([...project.functions, ...project.methods]);
    this.methodClassNames = new Map(project.methods.map((method) => [method.id, method.className]));
    this.bindings = unambiguousBindings(project.imports.flatMap((imp) =>
      this.importBindings(imp).map(([name, location]) => [locationKey(imp.file, name), location] as const),
    ));
  }

  // Script ids of the in-repository modules an import loads; empty for third-party modules.
  importedFileIds(imp: PythonImport): readonly string[] {
    const files = new Set(this.importBindings(imp).map(([, location]) => location.file));
    return [...files].map((file) => this.fileIds.get(file)!);
  }

  callTargetId(call: PythonCall): string | undefined {
    if (call.receiverName && call.methodName && CLASS_RECEIVERS.has(call.receiverName)) {
      const className = this.methodClassNames.get(call.ownerId);
      return className ? this.callableIds.get(locationKey(call.file, `${className}.${call.methodName}`)) : undefined;
    }
    return call.calleeName ? this.idAt(this.callableIds, this.locateDotted(call.file, call.calleeName)) : undefined;
  }

  baseClassId(cls: PythonClass, base: string): string | undefined {
    const baseId = this.idAt(this.classIds, this.locateDotted(cls.file, base));
    // `class User(User):` extends an imported User, which the local declaration shadows here.
    return baseId === cls.id ? undefined : baseId;
  }

  private importBindings(imp: PythonImport): readonly ImportBinding[] {
    const moduleFile = this.moduleFile(imp, imp.module);
    if (imp.form === "import") {
      return moduleFile ? imp.names.map((name) => [name.alias ?? name.name, { file: moduleFile }]) : [];
    }
    return imp.names.flatMap((name): ImportBinding[] => {
      const submoduleFile = this.moduleFile(imp, joinModule(imp.module, name.name));
      const location = submoduleFile ? { file: submoduleFile } : moduleFile && { file: moduleFile, name: name.name };
      return location ? [[name.alias ?? name.name, location]] : [];
    });
  }

  private moduleFile(imp: PythonImport, dottedModule: string): string | undefined {
    const modulePath = dottedModule.replaceAll(".", "/");
    if (imp.relative) {
      return this.findModule(posix.join(packageDirectory(imp), modulePath));
    }
    const matches = this.roots.flatMap((root) => {
      const file = this.findModule(posix.join(root, modulePath));
      return file ? [{ root, file }] : [];
    });
    const fromOwnRoot = matches.find((match) => isWithin(imp.file, match.root));
    return fromOwnRoot?.file ?? (matches.length === 1 ? matches[0]!.file : undefined);
  }

  // A package directory wins over a same-named module file, as in CPython's path finder.
  private findModule(path: string): string | undefined {
    return [posix.join(path, "__init__.py"), `${path}.py`].find((file) => this.fileIds.has(file));
  }

  // Resolves `name` or `owner.member` (module attribute or class member) to its declaration.
  private locateDotted(file: string, dotted: string): Location | undefined {
    const dot = dotted.lastIndexOf(".");
    if (dot < 0) return this.locate(file, dotted);
    const owner = this.locate(file, dotted.slice(0, dot));
    const member = dotted.slice(dot + 1);
    if (!owner) return undefined;
    return owner.name === undefined
      ? this.locate(owner.file, member)
      : { file: owner.file, name: `${owner.name}.${member}` };
  }

  // Follows imports, including package re-exports, to the file that declares `name`.
  private locate(file: string, name: string, hops = 0): Location | undefined {
    const key = locationKey(file, name);
    if (this.classIds.has(key) || this.callableIds.has(key)) return { file, name };
    const imported = this.bindings.get(key);
    if (imported?.name === undefined || hops === MAX_REEXPORT_HOPS) return imported;
    return this.locate(imported.file, imported.name, hops + 1);
  }

  private idAt(ids: ReadonlyMap<string, string>, location: Location | undefined): string | undefined {
    return location?.name === undefined ? undefined : ids.get(locationKey(location.file, location.name));
  }
}

function locationKey(file: string, name: string): string {
  return `${file}\0${name}`;
}

function idsByLocation(
  declarations: readonly { readonly id: string; readonly file: string; readonly name: string }[],
): ReadonlyMap<string, string> {
  return new Map(declarations.map((declaration) => [locationKey(declaration.file, declaration.name), declaration.id]));
}

// A name bound to different targets (e.g. try/except import fallbacks) resolves to neither.
function unambiguousBindings(entries: readonly (readonly [string, Location])[]): ReadonlyMap<string, Location> {
  const bindings = new Map<string, Location>();
  const ambiguous = new Set<string>();
  for (const [key, location] of entries) {
    const bound = bindings.get(key);
    if (bound && (bound.file !== location.file || bound.name !== location.name)) ambiguous.add(key);
    bindings.set(key, location);
  }
  for (const key of ambiguous) bindings.delete(key);
  return bindings;
}

// The repository root plus each directory that holds a top-level package (e.g. `src`), deepest first.
function sourceRoots(files: ReadonlySet<string>): readonly string[] {
  const roots = new Set(["."]);
  for (const file of files) {
    if (posix.basename(file) !== "__init__.py") continue;
    const parent = posix.dirname(posix.dirname(file));
    if (!files.has(posix.join(parent, "__init__.py"))) roots.add(parent);
  }
  return [...roots].sort((a, b) => depth(b) - depth(a) || a.localeCompare(b));
}

function depth(directory: string): number {
  return directory === "." ? 0 : directory.split("/").length;
}

function isWithin(file: string, directory: string): boolean {
  return directory === "." || file.startsWith(`${directory}/`);
}

function packageDirectory(imp: PythonImport): string {
  const parentHops = Array.from({ length: imp.relativeLevel - 1 }, () => "..");
  return posix.join(posix.dirname(imp.file), ...parentHops);
}

function joinModule(module: string, name: string): string {
  return module ? `${module}.${name}` : name;
}
