import { driver } from '@jprayner/piconet-nodejs';
import { ConfigOptions } from '../common';
import { PKG_VERSION } from '../version';

export const commandGetStatus = async (configOptions: ConfigOptions) => {
  console.log(`Ecoclient version  : ${PKG_VERSION}`);
  console.log(
    `Device name        : ${
      configOptions.deviceName ? configOptions.deviceName : '[auto]'
    }`,
  );
  console.log(`Local station no.  : ${configOptions.localStation}`);
  console.log(`Server station no. : ${configOptions.serverStation}`);
  console.log(
    `Debug enabled      : ${configOptions.debugEnabled ? 'true' : 'false'}`,
  );

  try {
    await driver.connect(configOptions.deviceName);
    const status = await driver.readStatus();
    await driver.close();

    console.log('Board connected    : true');
    console.log(`Firmware version   : ${status.firmwareVersion}`);

    console.log(
      `ADLC status reg. 1 : ${status.statusRegister1
        .toString(2)
        .padStart(8, '0')}`,
    );
  } catch (e: unknown) {
    console.log('Board connected    : false');
    // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
    console.log(`Connection error   : ${e instanceof Error ? e.message : e}`);
  }
};
