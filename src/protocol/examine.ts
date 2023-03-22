import { driver } from '@jprayner/piconet-nodejs';
import {
  fsControlByte,
  fsPort,
  DirectoryHandles,
  standardTxMessage,
  stripCRs,
  waitForReceiveTxEvent,
} from '../common';

const timeoutMs = 2000;
const hasTimedOut = (startTime: number) => Date.now() - startTime > timeoutMs;

export type FileInfo = {
  id: string;
  name: string;
  loadAddress: string;
  execAddress: string;
  sizeBytes: number;
  date: string;
  access: string;
};

export const examineDir = async (
  serverStation: number,
  dirPath: string,
  handles: DirectoryHandles,
) => {
  const replyPort = 0x90;
  const functionCode = 0x03;

  let results: FileInfo[] = [];
  let startIndex = 0;
  const startTime = Date.now();
  while (!hasTimedOut(startTime)) {
    const examineHeader = Buffer.from([
      // return type a.k.a. ARG
      //    0x00 = all info, machine readable
      //    0x01 = all info, human readable
      //    0x02 = file title only
      //    0x03 = access + file title, character string
      0x01,
      // index of start of directory listing
      startIndex,
      // number of entries to return
      0x0b,
    ]);
    const examinePathTrailer = Buffer.from(`${dirPath}\r`);

    const msg = standardTxMessage(
      replyPort,
      functionCode,
      handles,
      Buffer.concat([examineHeader, examinePathTrailer]),
    );

    const txResult = await driver.transmit(
      serverStation,
      0,
      fsControlByte,
      fsPort,
      msg,
    );

    if (!txResult.success) {
      throw new Error(
        `Failed to send examine command to station ${serverStation}`,
      );
    }

    const serverReply = await waitForReceiveTxEvent(
      serverStation,
      fsControlByte,
      [replyPort],
    );

    if (serverReply.resultCode !== 0x00) {
      const message = stripCRs(serverReply.data.toString('ascii'));
      throw new Error(`Examine failed: ${message}`);
    }

    if (serverReply.data.length < 2) {
      throw new Error(
        `Malformed response from station ${serverStation}: success but not enough data`,
      );
    }

    const numEntriesReturned = serverReply.data[0];
    if (numEntriesReturned === 0) {
      break;
    }

    const fileData = serverReply.data.slice(2).toString('ascii');
    const filesWithAccess = fileData
      .split('\0')
      .filter(
        f => f.length != 0 && !(f.length === 1 && f.charCodeAt(0) === 0x80),
      )
      .map(f => {
        const [name, loadAddress, execAddress, sizeBytes, access, date, id] =
          f.split(/\s+/);
        return {
          id,
          name,
          loadAddress,
          execAddress,
          sizeBytes: parseInt(sizeBytes, 16),
          date,
          access,
        };
      });
    results = results.concat(filesWithAccess);
    startIndex += numEntriesReturned;
  }

  if (hasTimedOut(startTime)) {
    throw new Error(`Examine timed out after ${timeoutMs}ms`);
  }

  return results;
};
