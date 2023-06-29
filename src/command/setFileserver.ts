import { setServerStationNum } from '../config';

export const commandSetFileserver = async (station: string) => {
  await setServerStationNum(parseInt(station));
};
