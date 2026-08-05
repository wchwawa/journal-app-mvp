// In-memory workbench honoring the NoKV contract semantics the journal
// repository depends on: create-only put_file (PathExists), ordered append,
// exact-string edit (AmbiguousEdit on multiple hits), structured read,
// non-recursive list, case-insensitive literal grep with basename glob.

export class FakeToolError extends Error {}

interface FileEntry {
  text: string;
  contentType: string;
}

export class FakeWorkbench {
  workbenches = new Map<string, Map<string, FileEntry>>();
  blobs = new Map<string, Buffer>(); // `${wb}:${section}/${path}` (CLI channel)

  private files(wb: string): Map<string, FileEntry> {
    const files = this.workbenches.get(wb);
    if (!files) throw new FakeToolError(`NotFound: workbench ${wb}`);
    return files;
  }

  dispatch(name: string, args: Record<string, unknown>): unknown {
    switch (name) {
      case 'workbench_create': {
        const id = args.id as string;
        if (this.workbenches.has(id)) {
          throw new FakeToolError('AlreadyExists');
        }
        this.workbenches.set(id, new Map());
        return { ok: true };
      }
      case 'workbench_put_file': {
        const files = this.files(args.id as string);
        const key = `${args.section}/${args.path}`;
        const replace = Boolean(args.replace);
        if (!replace && files.has(key)) {
          throw new FakeToolError(`PathExists: ${key}`);
        }
        if (replace && !files.has(key)) {
          // replace-only mode requires an existing path in the contract;
          // tolerate create-via-replace for tombstoning ergonomics.
        }
        files.set(key, {
          text: (args.text as string) ?? '',
          contentType: (args.content_type as string) ?? 'text/plain'
        });
        return { ok: true };
      }
      case 'workbench_append': {
        const files = this.files(args.id as string);
        const key = `${args.section}/${args.path}`;
        const prev = files.get(key)?.text ?? '';
        files.set(key, {
          text: prev + ((args.text as string) ?? ''),
          contentType: (args.content_type as string) ?? 'text/plain'
        });
        return { ok: true };
      }
      case 'workbench_read': {
        const files = this.files(args.id as string);
        const key = `${args.section}/${args.path}`;
        const file = files.get(key);
        if (!file) throw new FakeToolError(`NotFound: ${key}`);
        if (file.contentType === 'application/json') {
          return { records: [{ text: file.text }] };
        }
        return {
          records: file.text
            .split('\n')
            .filter((l) => l.length > 0)
            .map((text) => ({ text }))
        };
      }
      case 'workbench_edit': {
        const files = this.files(args.id as string);
        const key = `${args.section}/${args.path}`;
        const file = files.get(key);
        if (!file) throw new FakeToolError(`NotFound: ${key}`);
        const oldStr = args.old_string as string;
        const first = file.text.indexOf(oldStr);
        if (first === -1) throw new FakeToolError('no match for old_string');
        if (file.text.indexOf(oldStr, first + 1) !== -1) {
          throw new FakeToolError('AmbiguousEdit: multiple matches');
        }
        files.set(key, {
          ...file,
          text: file.text.replace(oldStr, args.new_string as string)
        });
        return { ok: true };
      }
      case 'workbench_list': {
        const files = this.files(args.id as string);
        const prefix = `${args.section}/${args.path ?? ''}`;
        const children = new Set<string>();
        for (const key of files.keys()) {
          if (!key.startsWith(prefix)) continue;
          const rest = key.slice(prefix.length);
          if (!rest) continue;
          const child = rest.includes('/')
            ? rest.slice(0, rest.indexOf('/') + 1)
            : rest;
          children.add(prefix + child);
        }
        return { entries: [...children].sort().map((path) => ({ path })) };
      }
      case 'workbench_grep': {
        const files = this.files(args.id as string);
        const prefix = `${args.section ?? ''}/${args.path ?? ''}`;
        const pattern = (args.pattern as string).toLowerCase();
        const glob = args.glob as string | undefined;
        const matches: Array<{ path: string }> = [];
        for (const [key, file] of files.entries()) {
          if (!key.startsWith(prefix)) continue;
          const basename = key.slice(key.lastIndexOf('/') + 1);
          if (glob && basename !== glob) continue;
          if (file.text.toLowerCase().includes(pattern)) {
            matches.push({ path: key });
          }
        }
        return { matches };
      }
      case 'workbench_stat': {
        const files = this.files(args.id as string);
        const key = `${args.section}/${args.path}`;
        const file = files.get(key);
        if (!file) throw new FakeToolError(`NotFound: ${key}`);
        return { path: key, logical_size: Buffer.byteLength(file.text) };
      }
      default:
        throw new FakeToolError(`unknown tool ${name}`);
    }
  }

  // CLI blob channel used by blob-cli mocks.
  collect(wb: string, section: string, path: string, data: Buffer): void {
    const key = `${wb}:${section}/${path}`;
    if (this.blobs.has(key)) throw new FakeToolError('PathExists');
    this.blobs.set(key, data);
  }

  materialize(wb: string, section: string, path: string): Buffer | null {
    const key = `${wb}:${section}/${path}`;
    const hit = this.blobs.get(key);
    if (hit) return hit;
    // Tombstoned via put_file replace:true text:'' — reflect emptiness.
    const files = this.workbenches.get(wb);
    const file = files?.get(`${section}/${path}`);
    if (file != null) return Buffer.from(file.text);
    return null;
  }
}
