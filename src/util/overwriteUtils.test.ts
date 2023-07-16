import * as common from '../common';
import { FileOverwriteTracker, promptOverwrite } from './overwriteUtils';

// eslint-disable-next-line @typescript-eslint/no-unsafe-return
jest.mock('../common', () => ({
  __esModule: true,
  ...jest.requireActual('../common'),
}));

describe('overwriteUtils', () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  it('should return true if user chooses to overwrite', async () => {
    const tracker = new FileOverwriteTracker(false);
    jest.spyOn(common, 'getKeyPress').mockResolvedValueOnce('y');
    await expect(promptOverwrite('FNAME', tracker)).resolves.toBe(true);
  });

  it('should return false if user chooses to skip', async () => {
    const tracker = new FileOverwriteTracker(false);
    jest.spyOn(common, 'getKeyPress').mockResolvedValueOnce('s');
    await expect(promptOverwrite('FNAME', tracker)).resolves.toBe(false);
  });

  it('should return true if user has already selected yes to all', async () => {
    const tracker = new FileOverwriteTracker(true);
    await expect(promptOverwrite('FNAME', tracker)).resolves.toBe(true);
  });

  it('should return true if user selects yes to all, and flag as such in tracker', async () => {
    const tracker = new FileOverwriteTracker(false);
    jest.spyOn(common, 'getKeyPress').mockResolvedValueOnce('a');
    await expect(promptOverwrite('FNAME', tracker)).resolves.toBe(true);
    expect(tracker.isOverwriteAllSelected).toBe(true);
  });
});
