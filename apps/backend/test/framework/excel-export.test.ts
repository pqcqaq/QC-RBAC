import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import express from 'express';
import request from 'supertest';
import {
  createExcelExportHandler,
  createTimestampedExcelFileName,
} from '../../src/utils/excel-export';
import { binaryParser, loadWorksheet } from '../support/backend-testkit';

describe('Excel export framework', () => {
  it('streams xlsx responses from async row sources and normalizes exported values', async () => {
    const app = express();
    const longSheetName = 'Framework export sheet name is longer than thirty-one chars';

    app.get('/export', createExcelExportHandler({
      fileName: ({ fileName }: { fileName: string }) => fileName,
      sheetName: () => longSheetName,
      parseQuery: (query) => ({
        fileName: String(query.fileName ?? 'ops:report'),
      }),
      queryRows: async function* () {
        yield {
          name: 'alpha',
          active: true,
          tags: ['ops', 'framework'],
          meta: { level: 3 },
          happenedAt: new Date(2026, 2, 22, 9, 8, 7),
        };
      },
      columns: [
        {
          header: 'Name',
          value: (row) => row.name,
        },
        {
          header: 'Active',
          value: (row) => row.active,
        },
        {
          header: 'Tags',
          value: (row) => row.tags,
        },
        {
          header: 'Meta',
          value: (row) => row.meta,
        },
        {
          header: 'When',
          value: (row) => row.happenedAt,
        },
      ],
    }));

    const response = await request(app)
      .get('/export')
      .query({ fileName: 'ops:report' })
      .buffer(true)
      .parse(binaryParser)
      .expect(200);

    assert.match(
      String(response.headers['content-type']),
      /application\/vnd\.openxmlformats-officedocument\.spreadsheetml\.sheet/i,
    );
    assert.match(String(response.headers['content-disposition']), /ops-report\.xlsx/i);

    const worksheet = await loadWorksheet(response.body as Buffer);
    assert.equal(worksheet.name, longSheetName.slice(0, 31));
    assert.equal(worksheet.getRow(2).getCell(1).value, 'alpha');
    assert.equal(worksheet.getRow(2).getCell(2).value, '是');
    assert.equal(worksheet.getRow(2).getCell(3).value, 'ops，framework');
    assert.equal(worksheet.getRow(2).getCell(4).value, '{"level":3}');
    assert.equal(worksheet.getRow(2).getCell(5).value, '2026-03-22T01:08:07.000Z');
  });

  it('creates timestamped file names with zero-padded local datetime parts', () => {
    const fileName = createTimestampedExcelFileName('audit', new Date(2026, 2, 22, 9, 8, 7));

    assert.equal(fileName, 'audit-20260322-090807.xlsx');
  });

  it('supports resolving columns from exported rows for dynamic headers', async () => {
    const app = express();
    type DynamicMetricRow = {
      name: string;
      metrics: Record<string, number>;
    };

    app.get('/dynamic-export', createExcelExportHandler({
      fileName: 'dynamic-report',
      sheetName: 'Dynamic export',
      parseQuery: () => ({}),
      queryRows: async function* (): AsyncIterable<DynamicMetricRow> {
        yield {
          name: 'alpha',
          metrics: {
            visits: 12,
            downloads: 3,
          },
        };
        yield {
          name: 'beta',
          metrics: {
            visits: 9,
            signups: 2,
          },
        };
      },
      columns: ({ rows }) => {
        const metricKeys = [...new Set(rows.flatMap(row => Object.keys(row.metrics)))];

        return [
          {
            header: 'Name',
            value: (row) => row.name,
          },
          ...metricKeys.map(metricKey => ({
            header: metricKey.toUpperCase(),
            key: `metric_${metricKey}`,
            value: (row) => row.metrics[metricKey] ?? 0,
          })),
        ];
      },
    }));

    const response = await request(app)
      .get('/dynamic-export')
      .buffer(true)
      .parse(binaryParser)
      .expect(200);

    const worksheet = await loadWorksheet(response.body as Buffer);
    assert.equal(worksheet.getRow(1).getCell(1).value, 'Name');
    assert.equal(worksheet.getRow(1).getCell(2).value, 'VISITS');
    assert.equal(worksheet.getRow(1).getCell(3).value, 'DOWNLOADS');
    assert.equal(worksheet.getRow(1).getCell(4).value, 'SIGNUPS');
    assert.equal(worksheet.getRow(2).getCell(1).value, 'alpha');
    assert.equal(worksheet.getRow(2).getCell(2).value, '12');
    assert.equal(worksheet.getRow(2).getCell(3).value, '3');
    assert.equal(worksheet.getRow(2).getCell(4).value, '0');
    assert.equal(worksheet.getRow(3).getCell(1).value, 'beta');
    assert.equal(worksheet.getRow(3).getCell(2).value, '9');
    assert.equal(worksheet.getRow(3).getCell(3).value, '0');
    assert.equal(worksheet.getRow(3).getCell(4).value, '2');
  });
});
