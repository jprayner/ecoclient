import { getHandles } from '../config';
import { bye } from '../protocol/simpleCli';

export const commandBye = async (serverStation: number) => {
  await bye(serverStation, await getHandles());
};
