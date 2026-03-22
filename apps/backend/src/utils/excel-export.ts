import ExcelJS from 'exceljs';
import type { Request, RequestHandler } from 'express';
import { asyncHandler } from './http.js';

type ExcelRowSource<TRow> = AsyncIterable<TRow> | Iterable<TRow>;

export type ExcelExportColumn<TRow> = {
  header: string;
  key?: string;
  width?: number;
  value: (row: TRow) => unknown;
};

type CreateExcelExportHandlerOptions<TQuery, TRow> = {
  fileName: string | ((query: TQuery) => string);
  sheetName: string | ((query: TQuery) => string);
  parseQuery: (query: Request['query']) => TQuery;
  queryRows: (query: TQuery) => Promise<TRow[] | ExcelRowSource<TRow>> | TRow[] | ExcelRowSource<TRow>;
  columns: Array<ExcelExportColumn<TRow>>;
};

const EXCEL_CONTENT_TYPE =
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

const resolveValue = <TInput, TResult>(
  value: TResult | ((input: TInput) => TResult),
  input: TInput,
) => (typeof value === 'function' ? (value as (arg: TInput) => TResult)(input) : value);

const sanitizeFileName = (value: string) => {
  const normalized = value.trim().replace(/[\\/:*?"<>|]+/g, '-');
  if (!normalized) {
    return 'export.xlsx';
  }

  return normalized.toLowerCase().endsWith('.xlsx') ? normalized : `${normalized}.xlsx`;
};

const buildContentDisposition = (fileName: string) =>
  `attachment; filename="${fileName.replace(/"/g, '')}"; filename*=UTF-8''${encodeURIComponent(fileName)}`;

const estimateColumnWidth = (header: string) => Math.min(Math.max(header.length * 2 + 4, 12), 40);

const normalizeCellValue = (value: unknown): ExcelJS.CellValue => {
  if (value === undefined || value === null) {
    return '';
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (Array.isArray(value)) {
    return value.join('，');
  }

  if (typeof value === 'object') {
    return JSON.stringify(value);
  }

  if (typeof value === 'boolean') {
    return value ? '是' : '否';
  }

  return String(value);
};

const isAsyncIterable = <TValue>(value: unknown): value is AsyncIterable<TValue> =>
  typeof value === 'object'
  && value !== null
  && Symbol.asyncIterator in value;

const toAsyncIterable = async function* <TRow>(
  source: TRow[] | ExcelRowSource<TRow>,
): AsyncIterable<TRow> {
  if (isAsyncIterable<TRow>(source)) {
    yield* source;
    return;
  }

  for (const row of source) {
    yield row;
  }
};

const createWorksheetColumns = <TRow>(columns: Array<ExcelExportColumn<TRow>>) =>
  columns.map((column, index) => ({
    header: column.header,
    key: column.key ?? `column_${index + 1}`,
    width: column.width ?? estimateColumnWidth(column.header),
  }));

export const createTimestampedExcelFileName = (prefix: string, now = new Date()) => {
  const pad = (value: number) => value.toString().padStart(2, '0');
  const timestamp = [
    now.getFullYear(),
    pad(now.getMonth() + 1),
    pad(now.getDate()),
    '-',
    pad(now.getHours()),
    pad(now.getMinutes()),
    pad(now.getSeconds()),
  ].join('');

  return `${prefix}-${timestamp}.xlsx`;
};

export const createExcelExportHandler = <TQuery, TRow>({
  fileName,
  sheetName,
  parseQuery,
  queryRows,
  columns,
}: CreateExcelExportHandlerOptions<TQuery, TRow>): RequestHandler =>
  asyncHandler(async (req, res) => {
    const query = parseQuery(req.query);
    const resolvedFileName = sanitizeFileName(resolveValue(fileName, query));
    const resolvedSheetName = resolveValue(sheetName, query);
    const resolvedColumns = createWorksheetColumns(columns);
    const rows = await queryRows(query);

    res.status(200);
    res.setHeader('Content-Type', EXCEL_CONTENT_TYPE);
    res.setHeader('Content-Disposition', buildContentDisposition(resolvedFileName));
    res.setHeader('Cache-Control', 'no-store');

    const workbook = new ExcelJS.stream.xlsx.WorkbookWriter({
      stream: res,
      useStyles: true,
      useSharedStrings: true,
    });
    const worksheet = workbook.addWorksheet(resolvedSheetName.slice(0, 31), {
      views: [{ state: 'frozen', ySplit: 1 }],
    });

    worksheet.columns = resolvedColumns;
    worksheet.autoFilter = {
      from: { row: 1, column: 1 },
      to: { row: 1, column: resolvedColumns.length },
    };

    const headerRow = worksheet.getRow(1);
    headerRow.font = { bold: true };
    headerRow.alignment = { vertical: 'middle', horizontal: 'center' };
    headerRow.commit();

    for await (const row of toAsyncIterable(rows)) {
      const output = resolvedColumns.reduce<Record<string, ExcelJS.CellValue>>((result, column, index) => {
        result[column.key] = normalizeCellValue(columns[index].value(row));
        return result;
      }, {});
      worksheet.addRow(output).commit();
    }

    await worksheet.commit();
    await workbook.commit();
  });
