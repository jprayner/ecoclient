import { stringToMetadataType, setMetadataType } from '../config';

export const commandSetMetadata = async (type: string) => {
  const typeValue = stringToMetadataType(type);
  if (typeof typeValue === 'undefined') {
    throw new Error(`Invalid metadata type "${type}"`);
  }

  await setMetadataType(typeValue);
};
