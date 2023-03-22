import {
  driver,
  EconetEvent,
  ErrorEvent,
  RxTransmitEvent,
} from '@jprayner/piconet-nodejs';

export const fsControlByte = 0x80;
export const fsPort = 0x99;
export const replyPort = 0x90;

export const stripCRs = (str: string) => str.replace(/\r/g, '');

export type DirectoryHandles = {
  userRoot: number;
  current: number;
  library: number;
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
  return driver.waitForEvent((event: EconetEvent) => {
    const result =
      event instanceof RxTransmitEvent &&
      event.scoutFrame.length >= 6 &&
      event.scoutFrame[2] === serverStation &&
      event.scoutFrame[3] === 0 &&
      event.scoutFrame[6] === port;
    return result;
  }, 2000);
};

export const waitForReceiveTxEvent = async (
  serverStation: number,
  controlByte: number,
  ports: number[],
) => {
  const rxTransmitEvent = await driver.waitForEvent(
    responseMatcher(serverStation, 0, controlByte, ports),
    2000,
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
