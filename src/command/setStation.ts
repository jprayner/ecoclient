import { setLocalStationNum } from '../config';

export const commandSetStation = async (station: string) => {
  await setLocalStationNum(parseInt(station));
};
