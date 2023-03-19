import { driver } from '@jprayner/piconet-nodejs';

export const notify = async (station: number, message: string) => {
  for (const char of message) {
    await driver.transmit(
      station,
      0,
      0x85,
      0x00,
      Buffer.from(char),
      Buffer.from([0x00, 0x00, char.charCodeAt(0), 0x00]),
    );
  }
};
