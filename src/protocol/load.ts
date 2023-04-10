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

  const txResult = await driver.transmit(
    serverStation,
    0,
    fsControlByte,
    fsPort,
    msg,
  );
  if (!txResult.success) {
    throw new Error(`Failed to send LOAD command to station ${serverStation}`);
  }

  const serverReply = await waitForReceiveTxEvent(
    serverStation,
    fsControlByte,
    [replyPort],
  );
  if (serverReply.resultCode !== 0x00) {
    const message = stripCRs(serverReply.data.toString('ascii'));
    throw new Error(`Load failed: ${message}`);
  }

  if (serverReply.data.length < 26) {
    throw new Error(
      `Malformed response in LOAD from station ${serverStation}: success but not enough data`,
    );
  }

  const loadAddr = serverReply.data.readUInt32LE(0);
  const execAddr = serverReply.data.readUInt32LE(4);
  const size =
    serverReply.data[8] +
    (serverReply.data[9] << 8) +
    (serverReply.data[10] << 16);
  const access = serverReply.data[11];
  const date = serverReply.data.readUint16LE(12);
  const actualFilename = serverReply.data
    .subarray(14, 26)
    .toString('ascii')
    .trim();

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
