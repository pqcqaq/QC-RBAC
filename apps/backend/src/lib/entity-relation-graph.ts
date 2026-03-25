import chalk from 'chalk';
import type { PrismaClient } from './prisma-generated';

type TransactionAwarePrismaClient = PrismaClient & {
  _engineConfig?: {
    inlineSchema?: string;
  };
};

type PrismaRelationArity = 'required' | 'optional' | 'list';

export type PrismaEntityRelationEdge = {
  sourceModel: string;
  sourceField: string;
  sourceFieldArity: PrismaRelationArity;
  targetModel: string;
  relationName: string | null;
  fromFields: string[];
  toFields: string[];
};

export type PrismaEntityRelationGraph = {
  models: string[];
  edges: PrismaEntityRelationEdge[];
};

type Logger = Pick<typeof console, 'log' | 'warn'>;

type RelationComponent = {
  edges: PrismaEntityRelationEdge[];
  models: string[];
};

const relationFieldListPattern = /\b(fields|references)\s*:\s*\[([^\]]*)\]/g;
const relationNamePattern = /@relation\(\s*"([^"]+)"/;

const graphCache = new Map<string, PrismaEntityRelationGraph>();

const splitSchemaBlocks = (schema: string, keyword: 'model' | 'enum') => {
  const blocks: Array<{ name: string; body: string }> = [];
  const pattern = new RegExp(`\\b${keyword}\\s+(\\w+)\\s*\\{`, 'g');

  for (const match of schema.matchAll(pattern)) {
    const name = match[1];
    if (!name) {
      continue;
    }

    const openBraceIndex = (match.index ?? 0) + match[0].length - 1;
    let depth = 1;
    let cursor = openBraceIndex + 1;

    while (cursor < schema.length && depth > 0) {
      const character = schema[cursor];
      if (character === '{') {
        depth += 1;
      } else if (character === '}') {
        depth -= 1;
      }

      cursor += 1;
    }

    if (depth !== 0) {
      continue;
    }

    blocks.push({
      name,
      body: schema.slice(openBraceIndex + 1, cursor - 1),
    });
  }

  return blocks;
};

const collectFieldStatements = (modelBody: string) => {
  const statements: string[] = [];
  const lines = modelBody
    .split(/\r?\n/)
    .map((line) => line.replace(/\/\/.*$/, '').trim())
    .filter(Boolean);

  let pending = '';
  let parenBalance = 0;

  for (const line of lines) {
    if (line.startsWith('@@')) {
      continue;
    }

    pending = pending ? `${pending} ${line}` : line;
    parenBalance += (line.match(/\(/g) ?? []).length;
    parenBalance -= (line.match(/\)/g) ?? []).length;

    if (parenBalance > 0) {
      continue;
    }

    statements.push(pending);
    pending = '';
  }

  if (pending) {
    statements.push(pending);
  }

  return statements;
};

const parseRelationFields = (relationArgs: string, key: 'fields' | 'references') => {
  for (const match of relationArgs.matchAll(relationFieldListPattern)) {
    if (match[1] !== key) {
      continue;
    }

    return match[2]
      ?.split(',')
      .map((item) => item.trim())
      .filter(Boolean) ?? [];
  }

  return [];
};

const resolveFieldArity = (typeToken: string): PrismaRelationArity => {
  if (typeToken.includes('[]')) {
    return 'list';
  }

  if (typeToken.includes('?')) {
    return 'optional';
  }

  return 'required';
};

const buildEdgeFromStatement = (
  sourceModel: string,
  statement: string,
): PrismaEntityRelationEdge | null => {
  if (!statement.includes('@relation(')) {
    return null;
  }

  const tokens = statement.split(/\s+/);
  const sourceField = tokens[0];
  const targetTypeToken = tokens[1];
  if (!sourceField || !targetTypeToken) {
    return null;
  }

  const targetModel = targetTypeToken.replace(/[?\[\]]/g, '');
  const relationArgsMatch = statement.match(/@relation\(([\s\S]+)\)/);
  if (!relationArgsMatch?.[1]) {
    return null;
  }

  const fromFields = parseRelationFields(relationArgsMatch[1], 'fields');
  const toFields = parseRelationFields(relationArgsMatch[1], 'references');
  if (!fromFields.length || !toFields.length || fromFields.length !== toFields.length) {
    return null;
  }

  return {
    sourceModel,
    sourceField,
    sourceFieldArity: resolveFieldArity(targetTypeToken),
    targetModel,
    relationName: relationArgsMatch[0].match(relationNamePattern)?.[1] ?? null,
    fromFields,
    toFields,
  };
};

const getSchemaLabel = (client: PrismaClient) =>
  (client as TransactionAwarePrismaClient)._engineConfig?.inlineSchema ?? null;

const formatFieldMapping = (edge: PrismaEntityRelationEdge) =>
  edge.fromFields.map((field, index) => `${field}=${edge.toFields[index]}`).join('+');

const buildConnectedRelationComponents = (
  graph: PrismaEntityRelationGraph,
): RelationComponent[] => {
  const adjacency = new Map<string, Set<string>>();
  graph.models.forEach((model) => {
    adjacency.set(model, new Set());
  });

  graph.edges.forEach((edge) => {
    adjacency.get(edge.sourceModel)?.add(edge.targetModel);
    adjacency.get(edge.targetModel)?.add(edge.sourceModel);
  });

  const visited = new Set<string>();
  const components: RelationComponent[] = [];

  graph.models.forEach((model) => {
    if (visited.has(model)) {
      return;
    }

    const queue = [model];
    const models: string[] = [];
    visited.add(model);

    while (queue.length) {
      const current = queue.shift();
      if (!current) {
        continue;
      }

      models.push(current);
      [...(adjacency.get(current) ?? [])]
        .sort((left, right) => left.localeCompare(right, 'en'))
        .forEach((next) => {
          if (visited.has(next)) {
            return;
          }

          visited.add(next);
          queue.push(next);
        });
    }

    models.sort((left, right) => left.localeCompare(right, 'en'));
    const modelSet = new Set(models);
    const edges = graph.edges.filter((edge) =>
      modelSet.has(edge.sourceModel) && modelSet.has(edge.targetModel));

    components.push({ models, edges });
  });

  return components.sort((left, right) =>
    right.edges.length - left.edges.length
    || right.models.length - left.models.length
    || left.models[0]!.localeCompare(right.models[0]!, 'en'));
};

const formatCompactArity = (arity: PrismaRelationArity) =>
  arity === 'required' ? '!' : arity === 'optional' ? '?' : '*';

const formatCompactRelationToken = (edge: PrismaEntityRelationEdge) => {
  const relationTag = edge.relationName ? `,@${edge.relationName}` : '';
  return `${edge.sourceModel}.${edge.sourceField}->${edge.targetModel}`
    + `(${formatFieldMapping(edge)},${formatCompactArity(edge.sourceFieldArity)}${relationTag})`;
};

const wrapSegments = (
  prefix: string,
  segments: string[],
  options: {
    separator?: string;
    width?: number;
  } = {},
) => {
  const separator = options.separator ?? ' | ';
  const width = options.width ?? 140;
  const continuationPrefix = ' '.repeat(prefix.length);
  const lines: string[] = [];

  if (!segments.length) {
    return [`${prefix}(none)`];
  }

  let current = prefix;
  segments.forEach((segment, index) => {
    const separatorText = index === 0 ? '' : separator;
    const candidate = `${current}${separatorText}${segment}`;
    if (candidate.length <= width || current === prefix) {
      current = candidate;
      return;
    }

    lines.push(current);
    current = `${continuationPrefix}${segment}`;
  });

  lines.push(current);
  return lines;
};

const formatModelPreview = (models: string[], maxModels = 8) => {
  if (models.length <= maxModels) {
    return models.join(', ');
  }

  return `${models.slice(0, maxModels).join(', ')}, ...(+${models.length - maxModels})`;
};

export const buildPrismaEntityRelationGraphFromSchema = (
  schema: string,
): PrismaEntityRelationGraph => {
  const cached = graphCache.get(schema);
  if (cached) {
    return cached;
  }

  const modelBlocks = splitSchemaBlocks(schema, 'model');
  const models = modelBlocks
    .map((block) => block.name)
    .sort((left, right) => left.localeCompare(right, 'en'));

  const edges = modelBlocks
    .flatMap((block) =>
      collectFieldStatements(block.body)
        .map((statement) => buildEdgeFromStatement(block.name, statement))
        .filter((edge): edge is PrismaEntityRelationEdge => Boolean(edge)))
    .sort((left, right) =>
      left.sourceModel.localeCompare(right.sourceModel, 'en')
      || left.targetModel.localeCompare(right.targetModel, 'en')
      || left.sourceField.localeCompare(right.sourceField, 'en'));

  const graph = {
    models,
    edges,
  } satisfies PrismaEntityRelationGraph;

  graphCache.set(schema, graph);
  return graph;
};

export const buildPrismaEntityRelationGraph = (
  client: PrismaClient,
): PrismaEntityRelationGraph | null => {
  const schema = getSchemaLabel(client);
  if (!schema) {
    return null;
  }

  return buildPrismaEntityRelationGraphFromSchema(schema);
};

export const formatPrismaEntityRelationGraph = (
  graph: PrismaEntityRelationGraph,
) => {
  const outgoingByModel = new Map<string, PrismaEntityRelationEdge[]>();
  const incomingByModel = new Map<string, PrismaEntityRelationEdge[]>();

  graph.edges.forEach((edge) => {
    const outgoing = outgoingByModel.get(edge.sourceModel) ?? [];
    outgoing.push(edge);
    outgoingByModel.set(edge.sourceModel, outgoing);

    const incoming = incomingByModel.get(edge.targetModel) ?? [];
    incoming.push(edge);
    incomingByModel.set(edge.targetModel, incoming);
  });

  const lines = [
    `[backend] entity relation graph (models=${graph.models.length}, edges=${graph.edges.length})`,
  ];

  graph.models.forEach((model) => {
    lines.push(model);

    const outgoing = outgoingByModel.get(model) ?? [];
    if (outgoing.length) {
      lines.push('  outgoing:');
      outgoing.forEach((edge) => {
        lines.push(`    - ${edge.sourceField} -> ${edge.targetModel} [${formatFieldMapping(edge)}]`);
      });
    }

    const incoming = incomingByModel.get(model) ?? [];
    if (incoming.length) {
      lines.push('  incoming:');
      incoming.forEach((edge) => {
        lines.push(`    - ${edge.sourceModel}.${edge.sourceField} [${formatFieldMapping(edge)}]`);
      });
    }

    if (!outgoing.length && !incoming.length) {
      lines.push('  (no relations)');
    }
  });

  return lines.join('\n');
};

export const formatPrismaEntityRelationCompactText = (
  graph: PrismaEntityRelationGraph,
  options: {
    width?: number;
  } = {},
) => {
  const components = buildConnectedRelationComponents(graph);
  const lines = [
    `[backend] entity relation graph (models=${graph.models.length}, edges=${graph.edges.length}, components=${components.length})`,
  ];

  components.forEach((component, index) => {
    lines.push(
      `c${index + 1} models=${component.models.length} edges=${component.edges.length} `
      + `nodes=${formatModelPreview(component.models)}`,
    );
    lines.push(...wrapSegments(
      '  relations: ',
      component.edges.map(formatCompactRelationToken),
      { width: options.width },
    ));
  });

  return lines.join('\n');
};

export const formatPrismaEntityRelationTerminalDiagram = (
  graph: PrismaEntityRelationGraph,
) => formatPrismaEntityRelationCompactText(graph);

const formatMermaidCardinality = (arity: PrismaRelationArity) =>
  arity === 'list' ? 'o{' : arity === 'optional' ? 'o|' : '||';

export const formatPrismaEntityRelationMermaid = (
  graph: PrismaEntityRelationGraph,
) => {
  const lines = ['erDiagram'];

  graph.models.forEach((model) => {
    lines.push(`  ${model} {`);
    lines.push('    string id PK');
    lines.push('  }');
  });

  graph.edges.forEach((edge, index) => {
    const relationId = `r${String(index + 1).padStart(2, '0')}`;
    lines.push(`  %% ${relationId} ${formatCompactRelationToken(edge)}`);
    lines.push(`  ${edge.sourceModel} ${formatMermaidCardinality(edge.sourceFieldArity)}--|| ${edge.targetModel} : ${relationId}`);
  });

  return lines.join('\n');
};

export const printPrismaEntityRelationGraph = (
  client: PrismaClient,
  logger: Logger = console,
) => {
  const graph = buildPrismaEntityRelationGraph(client);
  if (!graph) {
    logger.warn('[backend] entity relation graph unavailable: Prisma inline schema is missing');
    return null;
  }

  logger.log(chalk.cyan(formatPrismaEntityRelationCompactText(graph)));

  if (process.env.RBAC_PRINT_RELATION_GRAPH_DETAILS === '1') {
    logger.log(chalk.gray('[backend] entity relation detail summary'));
    logger.log(formatPrismaEntityRelationGraph(graph));
  }

  if (process.env.RBAC_PRINT_RELATION_GRAPH_MERMAID === '1') {
    logger.log(chalk.gray('[backend] entity relation graph (Mermaid)'));
    logger.log(formatPrismaEntityRelationMermaid(graph));
  }
  return graph;
};
