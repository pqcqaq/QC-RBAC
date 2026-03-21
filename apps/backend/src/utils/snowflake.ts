import { env } from '../config/env.js';

const sequenceBits = 12n;
const nodeIdBits = 10n;
const maxSequence = (1n << sequenceBits) - 1n;
const maxNodeId = (1n << nodeIdBits) - 1n;
const timestampShift = sequenceBits + nodeIdBits;
const nodeIdShift = sequenceBits;

const nodeId = BigInt(env.SNOWFLAKE_NODE_ID);
if (nodeId < 0n || nodeId > maxNodeId) {
  throw new Error(`SNOWFLAKE_NODE_ID must be between 0 and ${maxNodeId.toString()}`);
}

const epoch = BigInt(env.SNOWFLAKE_EPOCH);

let lastTimestamp = -1n;
let sequence = 0n;

const now = () => BigInt(Date.now());

const waitUntilNextMillisecond = (currentTimestamp: bigint) => {
  let timestamp = now();
  while (timestamp <= currentTimestamp) {
    timestamp = now();
  }
  return timestamp;
};

export const generateSnowflakeId = () => {
  let timestamp = now();

  if (timestamp < lastTimestamp) {
    timestamp = waitUntilNextMillisecond(lastTimestamp);
  }

  if (timestamp === lastTimestamp) {
    sequence = (sequence + 1n) & maxSequence;
    if (sequence === 0n) {
      timestamp = waitUntilNextMillisecond(lastTimestamp);
    }
  } else {
    sequence = 0n;
  }

  lastTimestamp = timestamp;

  const id =
    ((timestamp - epoch) << timestampShift) |
    (nodeId << nodeIdShift) |
    sequence;

  return id.toString();
};
