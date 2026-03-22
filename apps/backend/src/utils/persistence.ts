import { generateSnowflakeId } from './snowflake';

export const withSnowflakeId = <T extends object>(data: T) => ({
  id: generateSnowflakeId(),
  ...data,
});

export const withSnowflakeIds = <T extends object>(rows: T[]) =>
  rows.map((row) => withSnowflakeId(row));
