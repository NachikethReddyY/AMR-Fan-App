import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import * as publicApi from './index';

test('the public interface exposes only a no-argument display reader and string leaves', () => {
  expect(Object.keys(publicApi)).toEqual(['getTestDataView']);
  expect(publicApi.getTestDataView).toHaveLength(0);
  function check(value: unknown): void {
    if (typeof value === 'string') return;
    expect(value).not.toBeNull();
    expect(typeof value).toBe('object');
    for (const child of Object.values(value ?? {})) check(child);
  }
  check(publicApi.getTestDataView());
});

test('production dependency graph cannot import account, storage, mutation or provider code', () => {
  const allowedRuntimeFiles = new Set([
    'index.ts',
    'presentation.ts',
    'fixtures.ts',
  ]);
  for (const filename of allowedRuntimeFiles) {
    const source = ts.createSourceFile(
      filename,
      fs.readFileSync(path.join(__dirname, filename), 'utf8'),
      ts.ScriptTarget.Latest,
      true,
    );
    function visit(node: ts.Node): void {
      if (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) {
        const typeOnly = ts.isImportDeclaration(node)
          ? node.importClause?.isTypeOnly
          : node.isTypeOnly;
        if (
          !typeOnly &&
          node.moduleSpecifier &&
          ts.isStringLiteral(node.moduleSpecifier)
        ) {
          expect(node.moduleSpecifier.text).toMatch(/^\.\//);
          expect(
            allowedRuntimeFiles.has(`${node.moduleSpecifier.text.slice(2)}.ts`),
          ).toBe(true);
        }
      }
      if (ts.isCallExpression(node)) {
        expect(node.expression.kind).not.toBe(ts.SyntaxKind.ImportKeyword);
        if (ts.isIdentifier(node.expression))
          expect(node.expression.text).not.toBe('require');
      }
      ts.forEachChild(node, visit);
    }
    visit(source);
  }
});
