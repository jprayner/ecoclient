import {
  DirectoryHandles,
  fsControlByte,
  fsPort,
  logProgress,
  responseMatcher,
  sleepMs,
  standardTxMessage,
  stripCRs,
  waitForReceiveTxEvent,
} from '../common';
import { driver, RxTransmitEvent } from '@jprayner/piconet-nodejs';

export const save = async (
  serverStation: number,
  fileData: Buffer,
  remoteFilename: string,
  loadAddr: number,
  execAddr: number,
  handles: DirectoryHandles,
) => {
  const replyPort = 0x90;
  const ackPort = 0x91;
  const functionCode = 0x01;

  const bufferLoadAddr = Buffer.from([
    loadAddr & 0xff,
    (loadAddr >> 8) & 0xff,
    (loadAddr >> 16) & 0xff,
    (loadAddr >> 24) & 0xff,
  ]);
  const bufferExecAddr = Buffer.from([
    execAddr & 0xff,
    (execAddr >> 8) & 0xff,
    (execAddr >> 16) & 0xff,
    (execAddr >> 24) & 0xff,
  ]);
  const bufferFileSize = Buffer.from([
    fileData.length & 0xff,
    (fileData.length >> 8) & 0xff,
    (fileData.length >> 16) & 0xff,
  ]);
  const bufferFileTitle = Buffer.from(`${remoteFilename}\r`);

  const requestData = Buffer.concat([
    bufferLoadAddr,
    bufferExecAddr,
    bufferFileSize,
    bufferFileTitle,
  ]);

  const msg = standardTxMessage(
    replyPort,
    functionCode,
    {
      userRoot: ackPort, // Unusual handling for SAVE: ack port lives here
      current: handles.current,
      library: handles.library,
    },
    requestData,
  );

  const replyQueue = driver.eventQueueCreate(
    responseMatcher(serverStation, 0, fsControlByte, [replyPort]),
  );

  const ackQueue = driver.eventQueueCreate(
    responseMatcher(serverStation, 0, fsControlByte, [ackPort]),
  );

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
        `Failed to send SAVE command to station ${serverStation}`,
      );
    }

    const serverReply = await waitForReceiveTxEvent(replyQueue, serverStation);

    if (serverReply.resultCode !== 0x00) {
      const message = stripCRs(serverReply.data.toString('ascii'));
      throw new Error(`Save failed: ${message}`);
    }

    if (serverReply.data.length < 3) {
      throw new Error(
        `Malformed response in SAVE from station ${serverStation}: success but not enough data`,
      );
    }

    const dataPort = serverReply.data[0];
    const blockSize = serverReply.data.readUInt16LE(1);
    let dataLeftToSend = Buffer.from(fileData);
    const fileSize = dataLeftToSend.length;
    while (dataLeftToSend.length > 0) {
      const dataToSend = dataLeftToSend.slice(0, blockSize);
      dataLeftToSend = dataLeftToSend.slice(blockSize);

      let sendSuccess = false;
      let lastError = '';
      for (let retry = 0; retry < 3 && !sendSuccess; retry++) {
        const dataTxResult = await driver.transmit(
          serverStation,
          0,
          fsControlByte,
          dataPort,
          dataToSend,
        );
        sendSuccess = dataTxResult.success;
        if (!dataTxResult.success) {
          lastError = dataTxResult.description;
          await sleepMs(100);
        }
      }

      if (!sendSuccess) {
        throw new Error(
          `Failed to send SAVE data to station ${serverStation}: ${lastError}}`,
        );
      }

      if (dataLeftToSend.length > 0) {
        // TODO: errr.... is there no way for this to fail i.e. nak?
        await driver.eventQueueWait(ackQueue, 10000, 'data ack');
      }

      const sentBytes = fileSize - dataLeftToSend.length;
      const percentComplete = Math.round(100 * (sentBytes / fileSize));
      logProgress(
        `Saving ${sentBytes}/${fileSize} bytes [${percentComplete}%]`,
      );
    }
    logProgress('');

    const finalReply = await waitForSaveStatus(replyQueue, serverStation);

    if (finalReply.resultCode !== 0x00) {
      throw new Error('Save failed');
    }
  } finally {
    driver.eventQueueDestroy(replyQueue);
    driver.eventQueueDestroy(ackQueue);
  }
};

const waitForSaveStatus = async (
  queue: driver.EventQueue,
  serverStation: number,
) => {
  const rxTransmitEvent = await driver.eventQueueWait(
    queue,
    2000,
    'save status',
  );
  if (!(rxTransmitEvent instanceof RxTransmitEvent)) {
    throw new Error(`Unexpected response from station ${serverStation}`);
  }
  if (rxTransmitEvent.dataFrame.length < 9) {
    throw new Error(`Malformed response from station ${serverStation}`);
  }

  return {
    commandCode: rxTransmitEvent.dataFrame[4],
    resultCode: rxTransmitEvent.dataFrame[5],
    accessByte: rxTransmitEvent.dataFrame[6],
    date: rxTransmitEvent.dataFrame.readUint16LE(7),
  };
};
