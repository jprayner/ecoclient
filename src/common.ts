import {
  driver,
  EconetEvent,
  ErrorEvent,
  RxTransmitEvent,
} from '@jprayner/piconet-nodejs';
import { existsSync, readFileSync, writeFileSync } from 'fs';

export const fsControlByte = 0x80;
export const fsPort = 0x99;
export const replyPort = 0x90;

export const stripCRs = (str: string) => str.replace(/\r/g, '');

export type DirectoryHandles = {
  userRoot: number;
  current: number;
  library: number;
};

export type FileInfo = {
  originalFilename: string;
  loadAddr: number;
  execAddr: number;
};

export const standardTxMessage = (
  serverPort: number,
  functionCode: number,
  handles: DirectoryHandles,
  data: Buffer,
) => {
  const header = Buffer.from([
    serverPort,
    functionCode,
    handles.userRoot,
    handles.current,
    handles.library,
  ]);
  return Buffer.concat([header, data]);
};

export const responseMatcher = (
  sourceStation: number,
  sourceNetwork: number,
  controlByte: number,
  ports: number[],
) => {
  return (event: EconetEvent) => {
    const result =
      event instanceof RxTransmitEvent &&
      event.scoutFrame.length >= 6 &&
      event.scoutFrame[2] === sourceStation &&
      event.scoutFrame[3] === sourceNetwork &&
      event.scoutFrame[4] === controlByte &&
      ports.find(p => p === event.scoutFrame[5]) !== undefined;
    return result;
  };
};

export const initConnection = async (
  device: string | undefined,
  station: number,
) => {
  await driver.connect(device);

  driver.addListener(event => {
    if (event instanceof ErrorEvent) {
      console.error(`ERROR: ${event.description}`);
    }
  });

  await driver.setEconetStation(station);
  await driver.setMode('LISTEN');
};

export const waitForAckEvent = async (serverStation: number, port: number) => {
  const ackTimeoutMs = 10000;
  return driver.waitForEvent((event: EconetEvent) => {
    const result =
      event instanceof RxTransmitEvent &&
      event.scoutFrame.length >= 6 &&
      event.scoutFrame[2] === serverStation &&
      event.scoutFrame[3] === 0 &&
      event.scoutFrame[5] === port;
    return result;
  }, ackTimeoutMs);
};

export const waitForReceiveTxEvent = async (
  serverStation: number,
  controlByte: number,
  ports: number[],
) => {
  const receiveTxEventTimeoutMs = 20000;
  const rxTransmitEvent = await driver.waitForEvent(
    responseMatcher(serverStation, 0, controlByte, ports),
    receiveTxEventTimeoutMs,
  );
  if (!(rxTransmitEvent instanceof RxTransmitEvent)) {
    throw new Error(`Unexpected response from station ${serverStation}`);
  }
  if (rxTransmitEvent.dataFrame.length < 6) {
    throw new Error(`Malformed response from station ${serverStation}`);
  }
  return {
    controlByte: rxTransmitEvent.scoutFrame[4],
    port: rxTransmitEvent.scoutFrame[5],
    commandCode: rxTransmitEvent.dataFrame[4],
    resultCode: rxTransmitEvent.dataFrame[5],
    data: rxTransmitEvent.dataFrame.slice(6),
  };
};

export const waitForDataOrStatus = async (
  serverStation: number,
  controlByte: number,
  dataPort: number,
  statusPort: number,
) => {
  const rxTransmitEvent = await driver.waitForEvent(
    responseMatcher(serverStation, 0, controlByte, [dataPort, statusPort]),
    2000,
  );
  if (!(rxTransmitEvent instanceof RxTransmitEvent)) {
    throw new Error(`Unexpected response from station ${serverStation}`);
  }
  if (rxTransmitEvent.scoutFrame[5] === statusPort) {
    if (rxTransmitEvent.dataFrame.length < 6) {
      throw new Error(`Malformed response from station ${serverStation}`);
    }

    return {
      type: 'status',
      controlByte: rxTransmitEvent.scoutFrame[4],
      port: rxTransmitEvent.scoutFrame[5],
      commandCode: rxTransmitEvent.dataFrame[4],
      resultCode: rxTransmitEvent.dataFrame[5],
      data: rxTransmitEvent.dataFrame.slice(6),
    };
  } else {
    if (rxTransmitEvent.dataFrame.length < 2) {
      throw new Error(`Malformed response from station ${serverStation}`);
    }

    return {
      type: 'data',
      data: rxTransmitEvent.dataFrame.slice(4),
    };
  }
};

export const executeCliCommand = async (
  serverStation: number,
  command: string,
  handles: DirectoryHandles,
) => {
  const functionCode = 0x00;

  const msg = standardTxMessage(
    replyPort,
    functionCode,
    handles,
    Buffer.from(`${command}\r`),
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
      `Failed to send command to station ${serverStation}: ${txResult.description}`,
    );
  }

  const serverReply = await waitForReceiveTxEvent(
    serverStation,
    fsControlByte,
    [replyPort],
  );

  if (serverReply.resultCode !== 0x00) {
    const message = stripCRs(serverReply.data.toString('ascii'));
    throw new Error(`Command failed: ${message}`);
  }

  return serverReply;
};

export const saveFileInfo = (localFilename: string, fileInfo: FileInfo) => {
  const infoBuffer = Buffer.from(
    `${fileInfo.originalFilename.padEnd(10)} ` +
      `${fileInfo.loadAddr.toString(16).toUpperCase().padStart(8, '0')} ` +
      `${fileInfo.execAddr.toString(16).toUpperCase().padStart(8, '0')}\n`,
  );
  writeFileSync(`${localFilename}.inf`, infoBuffer);
};

export const loadFileInfo = (localFilename: string): FileInfo | undefined => {
  const infoFilename = `${localFilename}.inf`;
  if (!existsSync(infoFilename)) {
    return undefined;
  }
  const infoBuffer = readFileSync(infoFilename);
  const info = infoBuffer.toString('utf-8').split('\n');
  if (info.length === 0) {
    return undefined;
  }

  const infoParts = info[0].split(/\s+/);
  if (infoParts.length < 3) {
    return undefined;
  }

  if (infoParts[1].length !== 8 || isNaN(parseInt(infoParts[1], 16))) {
    return undefined;
  }

  if (infoParts[2].length !== 8 || isNaN(parseInt(infoParts[2], 16))) {
    return undefined;
  }

  return {
    originalFilename: infoParts[0],
    loadAddr: parseInt(infoParts[1], 16),
    execAddr: parseInt(infoParts[2], 16),
  };
};

export const logProgress = (message: string) => {
  if (
    process.stdout.isTTY &&
    process.stdout.clearLine &&
    process.stdout.cursorTo
  ) {
    process.stdout.clearLine(0);
    process.stdout.cursorTo(0);
    process.stdout.write(message);
  }
};
