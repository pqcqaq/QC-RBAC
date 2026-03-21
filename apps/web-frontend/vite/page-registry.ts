import fs from 'node:fs/promises';
import path from 'node:path';
import ts from 'typescript';
import type { ModuleNode, Plugin, ResolvedConfig, ViteDevServer } from 'vite';
import type { PageDefinitionInput, PageDefinitionRecord } from '../src/meta/page-definition';

const VIRTUAL_MODULE_ID = 'virtual:page-registry';
const RESOLVED_VIRTUAL_MODULE_ID = `\0${VIRTUAL_MODULE_ID}`;
const VIEW_ROOT_SEGMENTS = ['src', 'pages'] as const;
const REQUIRED_PAGE_FIELDS = ['viewKey'] as const;

type SerializableValue =
  | string
  | number
  | boolean
  | null
  | SerializableValue[]
  | { [key: string]: SerializableValue };

type SerializableObject = Record<string, SerializableValue>;

const toPosixPath = (value: string) => value.split(path.sep).join(path.posix.sep);
const toPascalCase = (value: string) => value
  .split(/[^a-zA-Z0-9]+/)
  .filter(Boolean)
  .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
  .join('');

const isViewFile = (filePath: string, root: string) => {
  const normalizedFilePath = toPosixPath(path.resolve(filePath));
  const normalizedViewsRoot = `${toPosixPath(path.resolve(root, ...VIEW_ROOT_SEGMENTS))}/`;

  return normalizedFilePath.endsWith('.vue') && normalizedFilePath.startsWith(normalizedViewsRoot);
};

const invalidateVirtualModule = (server: ViteDevServer): ModuleNode | null => {
  const module = server.moduleGraph.getModuleById(RESOLVED_VIRTUAL_MODULE_ID);
  if (!module) {
    return null;
  }

  server.moduleGraph.invalidateModule(module);
  return module;
};

const watchForViewStructureChanges = (server: ViteDevServer, root: string) => {
  const reload = (filePath: string) => {
    if (!isViewFile(filePath, root)) {
      return;
    }

    const virtualModule = invalidateVirtualModule(server);
    if (!virtualModule) {
      return;
    }

    server.ws.send({ type: 'full-reload' });
  };

  server.watcher.on('add', reload);
  server.watcher.on('unlink', reload);
};

export const pageRegistryPlugin = (): Plugin => {
  let config: ResolvedConfig | null = null;

  return {
    name: 'rbac-page-registry',
    configureServer(server) {
      if (!config) {
        return;
      }

      watchForViewStructureChanges(server, config.root);
    },
    configResolved(resolvedConfig) {
      config = resolvedConfig;
    },
    resolveId(id) {
      if (id === VIRTUAL_MODULE_ID) {
        return RESOLVED_VIRTUAL_MODULE_ID;
      }

      return null;
    },
    async load(id) {
      if (id !== RESOLVED_VIRTUAL_MODULE_ID || !config) {
        return null;
      }

      const definitions = await collectPageDefinitions(config.root);
      return renderVirtualModule(definitions);
    },
    handleHotUpdate(context) {
      if (!config || !isViewFile(context.file, config.root)) {
        return;
      }

      const virtualModule = invalidateVirtualModule(context.server);
      if (!virtualModule) {
        return;
      }

      return [virtualModule];
    },
  };
};

const collectPageDefinitions = async (root: string): Promise<PageDefinitionRecord[]> => {
  const viewsRoot = path.resolve(root, ...VIEW_ROOT_SEGMENTS);
  const viewFiles = await listVueFiles(viewsRoot);
  const definitions: PageDefinitionRecord[] = [];

  for (const filePath of viewFiles) {
    const definition = await extractPageDefinition(filePath, root);
    if (definition) {
      definitions.push(definition);
    }
  }

  ensureUnique(definitions, 'viewKey');

  return definitions.sort((left, right) => left.viewKey.localeCompare(right.viewKey, 'en'));
};

const listVueFiles = async (directoryPath: string): Promise<string[]> => {
  const entries = await fs.readdir(directoryPath, { withFileTypes: true });
  const fileGroups = await Promise.all(entries.map(async (entry) => {
    const fullPath = path.join(directoryPath, entry.name);

    if (entry.isDirectory()) {
      return listVueFiles(fullPath);
    }

    return entry.isFile() && fullPath.endsWith('.vue') ? [fullPath] : [];
  }));

  return fileGroups.flat().sort((left, right) => left.localeCompare(right, 'en'));
};

const extractPageDefinition = async (filePath: string, root: string): Promise<PageDefinitionRecord | null> => {
  const source = await fs.readFile(filePath, 'utf8');
  const scriptContent = extractScriptContent(source);
  if (!scriptContent) {
    return null;
  }

  const sourceFile = ts.createSourceFile(filePath, scriptContent, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const pageDefinitionExpression = findDefinePageCall(sourceFile);
  if (!pageDefinitionExpression) {
    return null;
  }

  const definitionObject = readSerializableObject(pageDefinitionExpression, sourceFile);
  const pageDefinition = validatePageDefinition(definitionObject, filePath);
  const viewPath = toPosixPath(path.relative(path.resolve(root, ...VIEW_ROOT_SEGMENTS), filePath));

  return {
    ...pageDefinition,
    view: viewPath,
  };
};

const extractScriptContent = (source: string) => {
  const scripts: string[] = [];
  const scriptBlockPattern = /<script\b[^>]*>([\s\S]*?)<\/script>/g;

  for (const match of source.matchAll(scriptBlockPattern)) {
    const blockContent = match[1]?.trim();
    if (blockContent) {
      scripts.push(blockContent);
    }
  }

  return scripts.join('\n');
};

const findDefinePageCall = (sourceFile: ts.SourceFile): ts.Expression | null => {
  let pageDefinitionExpression: ts.Expression | null = null;

  const visit = (node: ts.Node) => {
    if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === 'definePage') {
      if (pageDefinitionExpression) {
        throw new Error(`Only one definePage() call is allowed in ${sourceFile.fileName}`);
      }

      if (node.arguments.length !== 1) {
        throw new Error(`definePage() expects exactly one argument in ${sourceFile.fileName}`);
      }

      pageDefinitionExpression = node.arguments[0] ?? null;
    }

    ts.forEachChild(node, visit);
  };

  visit(sourceFile);
  return pageDefinitionExpression;
};

const unwrapExpression = (expression: ts.Expression): ts.Expression => {
  if (ts.isAsExpression(expression) || ts.isSatisfiesExpression(expression) || ts.isParenthesizedExpression(expression) || ts.isTypeAssertionExpression(expression)) {
    return unwrapExpression(expression.expression);
  }

  return expression;
};

const readSerializableValue = (expression: ts.Expression, sourceFile: ts.SourceFile): SerializableValue => {
  const node = unwrapExpression(expression);

  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
    return node.text;
  }

  if (ts.isNumericLiteral(node)) {
    return Number(node.text);
  }

  if (node.kind === ts.SyntaxKind.TrueKeyword) {
    return true;
  }

  if (node.kind === ts.SyntaxKind.FalseKeyword) {
    return false;
  }

  if (node.kind === ts.SyntaxKind.NullKeyword) {
    return null;
  }

  if (ts.isPrefixUnaryExpression(node) && node.operator === ts.SyntaxKind.MinusToken) {
    const value = readSerializableValue(node.operand, sourceFile);
    if (typeof value !== 'number') {
      throw new Error(`Only numeric unary expressions are supported in ${sourceFile.fileName}`);
    }
    return -value;
  }

  if (ts.isArrayLiteralExpression(node)) {
    return node.elements.map((element) => readSerializableValue(element, sourceFile));
  }

  if (ts.isObjectLiteralExpression(node)) {
    return readSerializableObject(node, sourceFile);
  }

  throw new Error(`definePage() only supports static JSON-like values in ${sourceFile.fileName}`);
};

const readSerializableObject = (expression: ts.Expression, sourceFile: ts.SourceFile): SerializableObject => {
  const node = unwrapExpression(expression);
  if (!ts.isObjectLiteralExpression(node)) {
    throw new Error(`definePage() argument must be an object literal in ${sourceFile.fileName}`);
  }

  const result: SerializableObject = {};
  for (const property of node.properties) {
    if (!ts.isPropertyAssignment(property)) {
      throw new Error(`definePage() only supports plain object properties in ${sourceFile.fileName}`);
    }

    const key = readPropertyName(property.name, sourceFile);
    result[key] = readSerializableValue(property.initializer, sourceFile);
  }

  return result;
};

const readPropertyName = (name: ts.PropertyName, sourceFile: ts.SourceFile) => {
  if (ts.isIdentifier(name) || ts.isStringLiteral(name) || ts.isNumericLiteral(name)) {
    return name.text;
  }

  throw new Error(`definePage() does not support computed property names in ${sourceFile.fileName}`);
};

const validatePageDefinition = (
  definition: SerializableObject,
  filePath: string,
): Omit<PageDefinitionRecord, 'view'> => {
  const viewKey = expectString(definition.viewKey, 'viewKey', filePath);
  const keepAlive = definition.keepAlive === undefined
    ? false
    : expectBoolean(definition.keepAlive, 'keepAlive', filePath);
  const cacheName = definition.cacheName === undefined
    ? `${toPascalCase(viewKey)}View`
    : expectString(definition.cacheName, 'cacheName', filePath);
  const title = definition.title === undefined ? undefined : expectString(definition.title, 'title', filePath);
  const caption = definition.caption === undefined ? undefined : expectString(definition.caption, 'caption', filePath);
  const description = definition.description === undefined ? undefined : expectString(definition.description, 'description', filePath);
  const code = definition.code === undefined ? undefined : expectString(definition.code, 'code', filePath);

  for (const field of REQUIRED_PAGE_FIELDS) {
    if (!(field in definition)) {
      throw new Error(`Missing "${field}" in definePage() for ${filePath}`);
    }
  }

  return {
    viewKey,
    cacheName,
    title,
    caption,
    description,
    code,
    keepAlive,
  };
};

const expectString = (value: SerializableValue | undefined, fieldName: string, filePath: string) => {
  if (typeof value !== 'string') {
    throw new Error(`definePage().${fieldName} must be a string in ${filePath}`);
  }

  return value;
};

const expectBoolean = (value: SerializableValue | undefined, fieldName: string, filePath: string) => {
  if (typeof value !== 'boolean') {
    throw new Error(`definePage().${fieldName} must be a boolean in ${filePath}`);
  }

  return value;
};

const ensureUnique = <T extends PageDefinitionRecord, K extends 'viewKey'>(definitions: T[], key: K) => {
  const seen = new Map<string, string>();

  for (const definition of definitions) {
    const value = definition[key];
    const previousView = seen.get(value);

    if (previousView) {
      throw new Error(`Duplicate page ${key} "${value}" found in ${previousView} and ${definition.view}`);
    }

    seen.set(value, definition.view);
  }
};

const renderVirtualModule = (definitions: PageDefinitionRecord[]) => {
  const serializedDefinitions = JSON.stringify(definitions, null, 2);

  return `const pageDefinitions = ${serializedDefinitions};

const viewModules = import.meta.glob('/src/pages/**/*.vue');

export const pageRegistry = pageDefinitions.map((item) => {
  const component = viewModules[\`/src/pages/\${item.view}\`];
  if (!component) {
    throw new Error(\`Missing page view: \${item.view}\`);
  }

  return {
    ...item,
    component,
  };
});

export const pageRegistryMap = Object.fromEntries(
  pageRegistry.map((item) => [item.viewKey, item]),
);
`;
};
