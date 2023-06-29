import { notify } from '../protocol/notify';

export const commandNotify = async (station: string, message: string) => {
  await notify(parseInt(station), message);
};
