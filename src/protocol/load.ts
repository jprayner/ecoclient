import {
  fsControlByte,
  fsPort,
  standardTxMessage,
  stripCRs,
  waitForReceiveTxEvent,
  DirectoryHandles,
  logProgress,
  responseMatcher,
} from '../common';
import { driver, RxTransmitEvent } from '@jprayner/piconet-nodejs';

export const load = async (
  serverStation: number,
  filename: string,
  handles: DirectoryHandles,
) => {
  const replyPort = 0x90;
  const dataPort = 0x92;
  const functionCode = 0x02;
  const msg = standardTxMessage(
    replyPort,
    functionCode,
    {
      userRoot: dataPort, // Unusual handling for LOAD: dataPort lives here
      current: handles.current,
      library: handles.library,
    },
    Buffer.from(`${filename}\r`),
  );

  const initQueue = driver.eventQueueCreate(
    responseMatcher(serverStation, 0, fsControlByte, [replyPort]),
  );

  let serverReply;
  try {
    const txResult = await driver.transmit(
      serverStation,
      0,
      fsControlByte,
      fsPort,
      msg,
    );
    if (!txResult.success) {
      throw new Error(
        `Failed to send LOAD command to station ${serverStation}`,
      );
    }

    serverReply = await waitForReceiveTxEvent(initQueue, 2000);

    if (serverReply.resultCode !== 0x00) {
      const message = stripCRs(serverReply.data.toString('ascii'));
      throw new Error(`Load failed: ${message}`);
    }

    if (serverReply.data.length < 14) {
      throw new Error(
        `Malformed response in LOAD from station ${serverStation}: success but not enough data (${serverReply.data.length} bytes received)`,
      );
    }
  } finally {
    driver.eventQueueDestroy(initQueue);
  }

  const loadAddr = serverReply.data.readUInt32LE(0);
  const execAddr = serverReply.data.readUInt32LE(4);
  const size =
    serverReply.data[8] +
    (serverReply.data[9] << 8) +
    (serverReply.data[10] << 16);
  const access = serverReply.data[11];
  const date = serverReply.data.readUint16LE(12);
  const actualFilenameData = serverReply.data.subarray(14, 26);
  const actualFilename =
    actualFilenameData.length === 0
      ? filename
      : parseAsciiString(actualFilenameData).trim();

  const queue = driver.eventQueueCreate(
    responseMatcher(serverStation, 0, fsControlByte, [dataPort, replyPort]),
  );

  let data = Buffer.from('');
  let complete = false;
  while (!complete) {
    const rxTransmitEvent = await driver.eventQueueWait(queue, 2000);

    if (
      !(rxTransmitEvent instanceof RxTransmitEvent) ||
      rxTransmitEvent.scoutFrame.length < 6
    ) {
      throw new Error(`Unexpected response from station ${serverStation}`);
    }

    const port = rxTransmitEvent.scoutFrame[5];
    switch (port) {
      case replyPort: {
        if (rxTransmitEvent.dataFrame.length < 6) {
          throw new Error(`Malformed response from station ${serverStation}`);
        }

        const resultCode = rxTransmitEvent.dataFrame[5];
        const messageData = rxTransmitEvent.dataFrame.slice(6);

        if (resultCode !== 0x00) {
          const message = stripCRs(messageData.toString('ascii'));
          throw new Error(`Load failed: ${message}`);
        }

        complete = true;

        break;
      }

      case dataPort:
        if (rxTransmitEvent.dataFrame.length < 4) {
          throw new Error(`Malformed response from station ${serverStation}`);
        }

        data = Buffer.concat([data, rxTransmitEvent.dataFrame.slice(4)]);
        break;
    }
    const percentComplete = Math.round(100 * (data.length / size));
    logProgress(`Loading ${data.length}/${size} bytes [${percentComplete}%]`);
  }

  logProgress('');
  driver.eventQueueDestroy(queue);

  return {
    loadAddr,
    execAddr,
    size,
    access,
    date,
    actualFilename,
    actualSize: data.length,
    data,
  };
};

const parseAsciiString = (buffer: Buffer) => {
  const str = buffer.toString('ascii');
  for (let idx = 0; idx < str.length; idx++) {
    if (
      str.charCodeAt(idx) >= 128 ||
      str.charCodeAt(idx) == 0x0d ||
      str.charCodeAt(idx) == 0x00
    ) {
      return str.substring(0, idx);
    } else if (idx === str.length - 1) {
      return str;
    }
  }

  throw new Error('Failed to parse ASCII string');
};
