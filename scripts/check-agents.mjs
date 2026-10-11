import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync, realpathSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const failures = [];
const skills = readdirSync(resolve(root, '.agents/skills')).filter((name) =>
  existsSync(resolve(root, '.agents/skills', name, 'SKILL.md')),
);
const docs = [
  'AGENTS.md',
  'CLAUDE.md',
  'docs/CONTRIBUTING.md',
  'SECURITY.md',
  'docs/ROADMAP.md',
  'docs/bug.md',
  'docs/work.md',
  'docs/README.md',
  'docs/agents/compatibility.md',
  'docs/agents/collaboration.md',
  '.agents/skills/file-pr/SKILL.md',
];
for (const folder of ['docs/internals', 'docs/operations', 'docs/user']) {
  for (const file of readdirSync(resolve(root, folder))) {
    if (file.endsWith('.md')) docs.push(folder + '/' + file);
  }
}
if (readFileSync(resolve(root, 'CLAUDE.md'), 'utf8').trim() !== '@AGENTS.md') {
  failures.push('CLAUDE.md must import only the canonical @AGENTS.md.');
}
if (skills.length === 0) failures.push('No portable AMR skills found.');
for (const name of skills) {
  const path = '.agents/skills/' + name + '/SKILL.md';
  if (name.startsWith('amr-')) docs.push(path);
  const content = readFileSync(resolve(root, path), 'utf8');
  if (
    name.startsWith('amr-') &&
    (!content.startsWith('---\nname: ' + name + '\ndescription: ') ||
      !/^description: .{1,1024}$/m.test(content) ||
      !content.includes('\n---\n'))
  ) {
    failures.push(path + ': invalid portable frontmatter.');
  }
  const link = resolve(root, '.claude/skills', name, 'SKILL.md');
  if (
    !existsSync(link) ||
    realpathSync(link) !== realpathSync(resolve(root, path))
  ) {
    failures.push(
      name + ': Claude link does not resolve to the canonical skill.',
    );
  }
}
for (const path of docs) {
  const content = readFileSync(resolve(root, path), 'utf8');
  for (const match of content.matchAll(
    /\[[^\]]*\]\(([^\s)]+)(?:\s+[^)]*)?\)/g,
  )) {
    const target = match[1].split('#')[0];
    if (!target || /^[a-z]+:/i.test(target)) continue;
    if (
      !existsSync(
        resolve(dirname(resolve(root, path)), decodeURIComponent(target)),
      )
    ) {
      failures.push(path + ': missing link target ' + target);
    }
  }
  if (/\/(?:Users|home)\/[^\s]+/.test(content)) {
    failures.push(path + ': private machine path in portable guidance.');
  }
}
for (const path of [
  '.agents/skills/' + skills[0] + '/SKILL.md',
  '.claude/skills/' + skills[0],
]) {
  try {
    execFileSync('git', ['check-ignore', '-q', path], { cwd: root });
    failures.push(path + ': shared entry point is Git-ignored.');
  } catch (error) {
    if (error.status !== 1) throw error;
  }
}
if (failures.length) {
  console.error(failures.join('\n'));
  process.exitCode = 1;
} else {
  console.log(
    'PASS: ' +
      skills.length +
      ' canonical skills, Claude links, imports and ' +
      docs.length +
      ' maintained documents. Model adherence is not tested by this check.',
  );
}
