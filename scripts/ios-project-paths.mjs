import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
const unquote = s => String(s ?? '').replace(/^"|"$/g, '');
export function validateSwiftSources(project, sourceRoot) {
  const objects = project.hash.project.objects;
  const root = objects.PBXProject[project.hash.project.rootObject].mainGroup;
  const paths = new Map(), problems = [];
  function walk(id, directory, ancestry = new Set()) {
    if (ancestry.has(id)) throw Error('Cyclic Xcode group');
    const group = objects.PBXGroup?.[id];
    if (group) {
      const next = new Set(ancestry); next.add(id);
      const dir = resolve(unquote(group.sourceTree) === 'SOURCE_ROOT' ? sourceRoot : directory, unquote(group.path));
      for (const child of group.children ?? []) walk(child.value, dir, next);
      return;
    }
    const file = objects.PBXFileReference?.[id];
    if (file) paths.set(id, resolve(unquote(file.sourceTree) === 'SOURCE_ROOT' ? sourceRoot : directory, unquote(file.path)));
  }
  walk(root, sourceRoot);
  for (const [id, phase] of Object.entries(objects.PBXSourcesBuildPhase ?? {})) {
    if (id.endsWith('_comment')) continue;
    for (const entry of phase.files ?? []) {
      const build = objects.PBXBuildFile[entry.value];
      const reference = objects.PBXFileReference[build?.fileRef];
      if (!unquote(reference?.path).endsWith('.swift')) continue;
      const path = paths.get(build.fileRef);
      if (!path) problems.push(`Swift source is outside the project group tree: ${unquote(reference.path)}`);
      else if (!existsSync(path)) problems.push(`Swift build input does not exist: ${path}`);
    }
  }
  return problems;
}
