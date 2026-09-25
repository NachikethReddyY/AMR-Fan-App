import { spawnSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import {
  appendFileSync,
  cpSync,
  existsSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, isAbsolute, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const tools = JSON.parse(
  readFileSync(join(root, 'security/tools.json'), 'utf8'),
);

export function validateDastConfig(config) {
  if (!config || typeof config !== 'object')
    throw new Error('Missing DAST configuration.');
  if (
    config.status === 'not-implemented' &&
    config.target === null &&
    typeof config.reason === 'string' &&
    config.reason.trim()
  ) {
    return { applicable: false, reason: config.reason };
  }
  const target = config.target;
  if (
    config.status !== 'implemented' ||
    !target ||
    typeof target.dockerfile !== 'string' ||
    !/^[a-zA-Z0-9_./-]+$/.test(target.dockerfile) ||
    isAbsolute(target.dockerfile) ||
    target.dockerfile.split('/').includes('..') ||
    !Number.isInteger(target.port) ||
    target.port < 1 ||
    target.port > 65535
  ) {
    throw new Error(
      'DAST requires status implemented, a repository Dockerfile and port 1–65535.',
    );
  }
  return { applicable: true, dockerfile: target.dockerfile, port: target.port };
}

export function evaluateZapReport(status, report) {
  if (
    !report ||
    !Array.isArray(report.site) ||
    report.site.length === 0 ||
    report.site.some(
      (site) =>
        typeof site['@name'] !== 'string' || !Array.isArray(site.alerts),
    )
  ) {
    throw new Error('ZAP produced no valid scanned-site report.');
  }
  const alerts = report.site.flatMap((site) => site.alerts);
  if (alerts.some((alert) => !/^[0-3]$/.test(String(alert.riskcode)))) {
    throw new Error('ZAP produced an invalid alert risk.');
  }
  const blocking = alerts.filter((alert) => Number(alert.riskcode) >= 2);
  return {
    passed: (status === 0 || status === 2) && blocking.length === 0,
    blocking: blocking.map((alert) => alert.pluginid),
    alerts: alerts.length,
  };
}

function run(
  command,
  args,
  { accept = [0], capture = false, timeout = 600_000 } = {},
) {
  const result = spawnSync(command, args, {
    cwd: root,
    encoding: 'utf8',
    timeout,
    stdio: capture ? 'pipe' : 'inherit',
    maxBuffer: 20 * 1024 * 1024,
  });
  if (result.error || !accept.includes(result.status)) {
    throw new Error(
      command +
        ' failed: ' +
        (result.error?.message ?? result.status) +
        (capture ? '\n' + result.stderr : ''),
    );
  }
  return result;
}

function docker(args, options) {
  return run('docker', args, options);
}

// Include tracked and non-ignored new files, without mounting private config or the host repo.
function sourceSnapshot() {
  const directory = mkdtempSync(join(tmpdir(), 'amr-source-'));
  const files = run('git', ['ls-files', '-co', '--exclude-standard', '-z'], {
    capture: true,
  })
    .stdout.split('\0')
    .filter(Boolean);
  try {
    for (const path of new Set(files)) {
      const source = join(root, path);
      if (!existsSync(source)) continue;
      const actual = realpathSync(source);
      if (
        relative(root, actual).startsWith('..') ||
        isAbsolute(relative(root, actual))
      ) {
        throw new Error('Source link escapes repository: ' + path);
      }
      if (lstatSync(source).isSymbolicLink()) continue; // Canonical in-repo contents are scanned.
      mkdirSync(dirname(join(directory, path)), { recursive: true });
      cpSync(source, join(directory, path));
    }
    return directory;
  } catch (error) {
    rmSync(directory, { recursive: true, force: true });
    throw error;
  }
}

function scan(kind, directory) {
  const mount = [
    '--rm',
    '--network',
    'none',
    '-v',
    directory + ':/src:ro',
    '-w',
    '/src',
  ];
  if (kind === 'secrets') {
    return docker(
      [
        'run',
        ...mount,
        tools.gitleaks,
        'dir',
        '/src',
        '--redact',
        '--no-banner',
        '--exit-code',
        '1',
      ],
      { accept: [0, 1] },
    ).status;
  }
  return docker(
    [
      'run',
      ...mount,
      '-e',
      'SEMGREP_SEND_METRICS=off',
      '-e',
      'SEMGREP_ENABLE_VERSION_CHECK=0',
      tools.semgrep,
      'semgrep',
      'scan',
      '--config',
      '/src/security/semgrep.yml',
      '--metrics=off',
      '--disable-version-check',
      '--strict',
      '--error',
      '--no-git-ignore',
      '--exclude',
      'security/fixtures',
      '--exclude',
      '.agents',
      '--exclude',
      '.claude',
      '--exclude',
      '.scratch',
      '--exclude',
      '.evidence',
      '--exclude',
      'prototypes',
      '/src',
    ],
    { accept: [0, 1] },
  ).status;
}

function scanSource(kind) {
  const directory = sourceSnapshot();
  try {
    if (scan(kind, directory) !== 0)
      throw new Error(kind + ' found blocking findings.');
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}

function scannerSelfTest() {
  const directory = mkdtempSync(join(tmpdir(), 'amr-scanner-test-'));
  try {
    mkdirSync(join(directory, 'security'));
    cpSync(
      join(root, 'security/semgrep.yml'),
      join(directory, 'security/semgrep.yml'),
    );
    writeFileSync(join(directory, 'safe.js'), 'export const value = 42;\n');
    for (const kind of ['secrets', 'sast']) {
      if (scan(kind, directory) !== 0)
        throw new Error(kind + ' rejected the clean fixture.');
    }
    // Generated, nonfunctional credential-shaped data never enters version control.
    writeFileSync(
      join(directory, 'secret.txt'),
      'token=ghp_' + randomUUID().replaceAll('-', '') + 'abcd\n',
    );
    if (scan('secrets', directory) !== 1)
      throw new Error('Secret scanner missed the synthetic token.');
    rmSync(join(directory, 'secret.txt'));
    const unsafeCases = [
      ['dynamic execution', 'eval(userInput);'],
      ['TLS bypass', 'export const options = { rejectUnauthorized: false };'],
      [
        'public provider key',
        'export const key = process.env.EXPO_PUBLIC_OPENAI_API_KEY;',
      ],
      [
        'raw HTML',
        'export const Content = () => <div dangerouslySetInnerHTML={{ __html: userInput }} />;',
      ],
    ];
    for (const [name, source] of unsafeCases) {
      writeFileSync(join(directory, 'unsafe.jsx'), source + '\n');
      if (scan('sast', directory) !== 1)
        throw new Error('SAST missed ' + name + '.');
    }
    console.log(
      'PASS: scanners accept safe fixtures and reject unsafe fixtures.',
    );
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}

function dast(target, fixtureMode) {
  const id = 'amr-dast-' + randomUUID();
  const scanner = id + '-scanner';
  const app = id + '-target';
  const directory = sourceSnapshot();
  const reports = join(
    root,
    '.evidence/security',
    fixtureMode ?? 'application',
  );
  mkdirSync(reports, { recursive: true });
  // Run the scanner as the host user so reports need no world-writable permissions.
  const reportPath = join(reports, 'zap.json');
  rmSync(reportPath, { force: true });
  let result;
  try {
    docker([
      'build',
      '-q',
      '-t',
      id,
      '-f',
      join(directory, target.dockerfile),
      directory,
    ]);
    docker(['network', 'create', '--internal', id], { capture: true });
    docker(
      [
        'run',
        '-d',
        '--name',
        app,
        '--network',
        id,
        '--network-alias',
        'target',
        ...(fixtureMode === 'unsafe' ? ['-e', 'FIXTURE_UNSAFE=1'] : []),
        id,
      ],
      { capture: true },
    );
    const url = 'http://target:' + target.port;
    const readiness =
      'import urllib.request,time\n' +
      'for attempt in range(30):\n' +
      ' try:\n  urllib.request.urlopen("' +
      url +
      '", timeout=2).close(); break\n' +
      ' except Exception:\n  time.sleep(1)\n' +
      'else:\n raise SystemExit("Application did not become ready")\n';
    docker(
      ['run', '--rm', '--network', id, tools.zap, 'python3', '-c', readiness],
      { timeout: 90_000 },
    );
    result = docker(
      [
        'run',
        '--rm',
        '--name',
        scanner,
        '--user',
        String(process.getuid?.() ?? 1000) +
          ':' +
          String(process.getgid?.() ?? 1000),
        '-e',
        'HOME=/tmp',
        '-e',
        'JAVA_TOOL_OPTIONS=-Duser.home=/tmp',
        '--network',
        id,
        '-v',
        reports + ':/zap/wrk:rw',
        '-v',
        join(root, 'security/zap-rules.conf') + ':/zap/rules.conf:ro',
        tools.zap,
        'zap-baseline.py',
        '-t',
        url,
        '-m',
        '1',
        '-T',
        '3',
        '-c',
        '/zap/rules.conf',
        '-J',
        'zap.json',
        '-r',
        'zap.html',
        '-s',
        '-z',
        '-config autoupdate.checkOnStart=false -config autoupdate.downloadNewRelease=false -config autoupdate.installAddonUpdates=false',
      ],
      { accept: [0, 1, 2, 3], timeout: 360_000 },
    );
    const report = JSON.parse(readFileSync(reportPath, 'utf8'));
    const outcome = evaluateZapReport(result.status, report);
    if (!report.site.every((site) => site['@name'] === url)) {
      throw new Error('Unexpected scanned site in DAST report.');
    }
    console.log(
      JSON.stringify({
        target: fixtureMode
          ? 'scanner-' + fixtureMode + '-fixture'
          : 'application',
        scannerExit: result.status,
        ...outcome,
      }),
    );
    return { ...outcome, scannerExit: result.status };
  } finally {
    // Remove only uniquely named resources created by this invocation.
    for (const name of [scanner, app]) {
      docker(['rm', '-f', name], {
        accept: [0, 1],
        capture: true,
        timeout: 30_000,
      });
    }
    docker(['network', 'rm', id], {
      accept: [0, 1],
      capture: true,
      timeout: 30_000,
    });
    docker(['image', 'rm', id], {
      accept: [0, 1],
      capture: true,
      timeout: 30_000,
    });
    rmSync(directory, { recursive: true, force: true });
  }
}

function main(command) {
  if (command === 'dast' || command === 'dast-status') {
    const config = validateDastConfig(
      JSON.parse(readFileSync(join(root, 'security/dast-target.json'), 'utf8')),
    );
    if (command === 'dast-status') {
      const status = config.applicable
        ? 'configured'
        : 'not applicable: ' + config.reason;
      console.log(
        'Application DAST: ' +
          status +
          '. No scan performed by this status command.',
      );
      if (process.env.GITHUB_OUTPUT) {
        appendFileSync(
          process.env.GITHUB_OUTPUT,
          'applicable=' + config.applicable + '\n',
        );
      }
      if (process.env.GITHUB_STEP_SUMMARY) {
        appendFileSync(
          process.env.GITHUB_STEP_SUMMARY,
          'Application DAST: ' + status + '\n',
        );
      }
      return;
    }
    if (!config.applicable) {
      console.log('NOT APPLICABLE (not a pass): ' + config.reason);
      process.exitCode = 2;
      return;
    }
    docker(['info'], { capture: true, timeout: 30_000 });
    if (!dast(config).passed)
      throw new Error('Application DAST has blocking findings.');
    return;
  }
  docker(['info'], { capture: true, timeout: 30_000 });
  if (command === 'secrets' || command === 'sast') return scanSource(command);
  if (command === 'self-test') return scannerSelfTest();
  if (command === 'dast-self-test') {
    const target = {
      dockerfile: 'security/fixtures/dast/Dockerfile',
      port: 3000,
    };
    if (!dast(target, 'safe').passed)
      throw new Error('DAST rejected the safe fixture.');
    const unsafe = dast(target, 'unsafe');
    if (unsafe.passed || unsafe.scannerExit === 3 || unsafe.alerts === 0) {
      throw new Error(
        'DAST did not reject the unsafe fixture with actual findings.',
      );
    }
    console.log(
      'PASS: DAST scanner self-test only. No application was scanned.',
    );
    return;
  }
  throw new Error(
    'Usage: node scripts/security.mjs secrets|sast|self-test|dast|dast-status|dast-self-test',
  );
}

if (
  process.argv[1] &&
  realpathSync(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  try {
    main(process.argv[2]);
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
