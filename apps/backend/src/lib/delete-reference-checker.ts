import { Prisma, type PrismaClient } from '@prisma/client';
import { badRequest } from '../utils/errors';

type DeleteGuardOperation = 'delete' | 'deleteMany' | 'update' | 'updateMany';

type DeleteGuardArgs = {
  where?: unknown;
  data?: unknown;
};

type IncomingReference = {
  sourceModel: string;
  sourceField: string;
  fromFields: string[];
  toFields: string[];
};

type ReferenceBlock = IncomingReference & {
  count: number;
};

type DeleteCandidateRecord = Record<string, unknown> & {
  id: string;
};

type TransactionAwarePrismaClient = PrismaClient & {
  _createItxClient?: (transaction: unknown) => PrismaClient;
};

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const lowerFirst = (value: string) => value.charAt(0).toLowerCase() + value.slice(1);

const getModelDelegate = (client: PrismaClient, model: string) =>
  (client as unknown as Record<string, Record<string, (...args: any[]) => Promise<unknown>>>)[lowerFirst(model)];

const normalizeUniqueWhere = (where?: unknown) => {
  if (!isPlainObject(where)) {
    return {};
  }

  return Object.entries(where).reduce<Record<string, unknown>>((accumulator, [key, value]) => {
    if (value === undefined) {
      return accumulator;
    }

    if (isPlainObject(value)) {
      return {
        ...accumulator,
        ...value,
      };
    }

    return {
      ...accumulator,
      [key]: value,
    };
  }, {});
};

const mergeActiveWhere = (where: unknown, softDeleteModelNames: Set<string>, model: string) => {
  if (!softDeleteModelNames.has(model)) {
    return isPlainObject(where) ? where : {};
  }

  if (!isPlainObject(where)) {
    return { deleteAt: null };
  }

  if (Object.prototype.hasOwnProperty.call(where, 'deleteAt')) {
    return where;
  }

  return {
    ...where,
    deleteAt: null,
  };
};

const getDeleteAtWriteValue = (data?: unknown) => {
  if (!isPlainObject(data) || !Object.prototype.hasOwnProperty.call(data, 'deleteAt')) {
    return undefined;
  }

  const value = data.deleteAt;
  if (isPlainObject(value) && Object.prototype.hasOwnProperty.call(value, 'set')) {
    return value.set;
  }

  return value;
};

const buildIncomingReferenceMap = () => {
  const map = new Map<string, IncomingReference[]>();

  for (const model of Prisma.dmmf.datamodel.models) {
    for (const field of model.fields) {
      if (field.kind !== 'object' || !field.relationFromFields?.length || !field.relationToFields?.length) {
        continue;
      }

      const existing = map.get(field.type) ?? [];
      existing.push({
        sourceModel: model.name,
        sourceField: field.name,
        fromFields: [...field.relationFromFields],
        toFields: [...field.relationToFields],
      });
      map.set(field.type, existing);
    }
  }

  return map;
};

const incomingReferenceMap = buildIncomingReferenceMap();

const resolveGuardClient = (client: PrismaClient, internalParams?: unknown) => {
  if (!isPlainObject(internalParams) || !isPlainObject(internalParams.transaction)) {
    return client;
  }

  if (internalParams.transaction.kind !== 'itx') {
    return client;
  }

  const transactionClientFactory = (client as TransactionAwarePrismaClient)._createItxClient;
  if (typeof transactionClientFactory !== 'function') {
    return client;
  }

  return transactionClientFactory.call(client, internalParams.transaction);
};

const buildDeleteCandidateWhere = (
  operation: DeleteGuardOperation,
  args: DeleteGuardArgs,
  softDeleteModelNames: Set<string>,
  model: string,
) => {
  if (operation === 'delete' || operation === 'update') {
    return mergeActiveWhere(normalizeUniqueWhere(args.where), softDeleteModelNames, model);
  }

  return mergeActiveWhere(args.where, softDeleteModelNames, model);
};

const buildDeleteCandidateSelect = (references: IncomingReference[]) => {
  const select: Record<string, boolean> = { id: true };

  references.forEach((reference) => {
    reference.toFields.forEach((field) => {
      select[field] = true;
    });
  });

  return select;
};

const dedupeWhereClauses = (clauses: Record<string, unknown>[]) => {
  const seen = new Set<string>();
  const result: Record<string, unknown>[] = [];

  clauses.forEach((clause) => {
    const key = JSON.stringify(clause);
    if (seen.has(key)) {
      return;
    }

    seen.add(key);
    result.push(clause);
  });

  return result;
};

const buildReferenceSelector = (reference: IncomingReference, record: DeleteCandidateRecord) =>
  reference.fromFields.reduce<Record<string, unknown>>((selector, fromField, index) => {
    selector[fromField] = record[reference.toFields[index]];
    return selector;
  }, {});

const resolveReferenceBlocks = async (input: {
  client: PrismaClient;
  model: string;
  records: DeleteCandidateRecord[];
  softDeleteModelNames: Set<string>;
}) => {
  const references = incomingReferenceMap.get(input.model) ?? [];
  if (!references.length || !input.records.length) {
    return [];
  }

  const deletingIds = input.records.map((record) => record.id);
  const blocks: ReferenceBlock[] = [];

  for (const reference of references) {
    const sourceDelegate = getModelDelegate(input.client, reference.sourceModel);
    const selectors = dedupeWhereClauses(
      input.records
        .map((record) => buildReferenceSelector(reference, record))
        .filter((selector) => Object.values(selector).every((value) => value !== undefined)),
    );

    if (!selectors.length) {
      continue;
    }

    let where: Record<string, unknown> =
      selectors.length === 1
        ? selectors[0]
        : { OR: selectors };

    if (reference.sourceModel === input.model) {
      where = {
        AND: [
          where,
          {
            NOT: {
              id: {
                in: deletingIds,
              },
            },
          },
        ],
      };
    }

    where = mergeActiveWhere(where, input.softDeleteModelNames, reference.sourceModel);
    const count = await sourceDelegate.count({ where }) as number;

    if (count > 0) {
      blocks.push({
        ...reference,
        count,
      });
    }
  }

  return blocks;
};

const buildReferenceBlockedMessage = (model: string, blocks: ReferenceBlock[]) => {
  const [firstBlock] = blocks;
  if (!firstBlock) {
    return `Cannot delete ${model} because related records still exist`;
  }

  return `Cannot delete ${model} because it is still referenced by ${firstBlock.sourceModel}.${firstBlock.sourceField} (${firstBlock.count} records)`;
};

export const isDeleteGuardedOperation = (
  model: string | undefined,
  operation: string,
  args: DeleteGuardArgs,
  softDeleteModelNames: Set<string>,
): operation is DeleteGuardOperation => {
  if (!model) {
    return false;
  }

  if (operation === 'delete' || operation === 'deleteMany') {
    return true;
  }

  if ((operation === 'update' || operation === 'updateMany') && softDeleteModelNames.has(model)) {
    return getDeleteAtWriteValue(args.data) != null;
  }

  return false;
};

export const assertNoDeleteReferenceBlocks = async (input: {
  client: PrismaClient;
  model: string;
  operation: DeleteGuardOperation;
  args: DeleteGuardArgs;
  softDeleteModelNames: Set<string>;
  internalParams?: unknown;
}) => {
  const references = incomingReferenceMap.get(input.model) ?? [];
  if (!references.length) {
    return;
  }

  const guardClient = resolveGuardClient(input.client, input.internalParams);
  const delegate = getModelDelegate(guardClient, input.model);
  const records = await delegate.findMany({
    where: buildDeleteCandidateWhere(input.operation, input.args, input.softDeleteModelNames, input.model),
    select: buildDeleteCandidateSelect(references),
  }) as DeleteCandidateRecord[];

  if (!records.length) {
    return;
  }

  const blocks = await resolveReferenceBlocks({
    client: guardClient,
    model: input.model,
    records,
    softDeleteModelNames: input.softDeleteModelNames,
  });

  if (!blocks.length) {
    return;
  }

  throw badRequest(buildReferenceBlockedMessage(input.model, blocks), {
    model: input.model,
    references: blocks.map((block) => ({
      sourceModel: block.sourceModel,
      sourceField: block.sourceField,
      count: block.count,
    })),
  });
};
