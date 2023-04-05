import {
  fsControlByte,
  fsPort,
  standardTxMessage,
  stripCRs,
  waitForReceiveTxEvent,
  waitForDataOrStatus,
  DirectoryHandles,
  logProgress,
} from '../common';
import { driver } from '@jprayner/piconet-nodejs';

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
  let data = Buffer.from('');
  let complete = false;
  while (!complete) {
    const dataOrEndEvent = await waitForDataOrStatus(
      serverStation,
      fsControlByte,
      dataPort,
      replyPort,
    );
    if (dataOrEndEvent.port === replyPort) {
      if (dataOrEndEvent.resultCode !== 0x00) {
        const message = stripCRs(dataOrEndEvent.data.toString('ascii'));
        throw new Error(`Load failed during delivery: ${message}`);
      }

      complete = true;
      continue;
    }

    data = Buffer.concat([data, dataOrEndEvent.data]);

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
