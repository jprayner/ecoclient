import * as common from '../common';
import { DeletePromptTracker, FileType, promptDelete } from './deleteUtils';

// eslint-disable-next-line @typescript-eslint/no-unsafe-return
jest.mock('../common', () => ({
  __esModule: true,
  ...jest.requireActual('../common'),
}));

describe('deleteUtils', () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  it('should return true if user chooses to delete', async () => {
    const tracker = new DeletePromptTracker(false);
    jest.spyOn(common, 'getKeyPress').mockResolvedValueOnce('y');
    await expect(promptDelete('FNAME', FileType.File, tracker)).resolves.toBe(
      true,
    );
  });

  it('should return false if user chooses to delete', async () => {
    const tracker = new DeletePromptTracker(false);
    jest.spyOn(common, 'getKeyPress').mockResolvedValueOnce('s');
    await expect(
      promptDelete('FNAME', FileType.Directory, tracker),
    ).resolves.toBe(false);
  });

  it('should return true if user has already selected yes to all', async () => {
    const tracker = new DeletePromptTracker(true);
    await expect(promptDelete('FNAME', FileType.File, tracker)).resolves.toBe(
      true,
    );
  });

  it('should return true if user selects yes to all, and flag as such in tracker', async () => {
    const tracker = new DeletePromptTracker(false);
    jest.spyOn(common, 'getKeyPress').mockResolvedValueOnce('a');
    await expect(promptDelete('FNAME', FileType.File, tracker)).resolves.toBe(
      true,
    );
    expect(tracker.isDeleteAllSelected).toBe(true);
  });
});
