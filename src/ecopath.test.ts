import {
  isValidName,
  isValidWildcardName,
  isWildcardMatch,
  parseDirBase,
  parseFileSpecifier,
} from './ecopath';

describe('ecopath.isValidName', () => {
  it('should accept valid filenames', () => {
    expect(isValidName('A')).toBe(true);
    expect(isValidName('a')).toBe(true);
    expect(isValidName('0')).toBe(true);
    expect(isValidName('9')).toBe(true);
    expect(isValidName('1234567890')).toBe(true);
    expect(isValidName('!BOOT')).toBe(true);
  });

  it('should reject empty filename', () => {
    expect(isValidName('')).toBe(false);
  });

  it('should reject too-long filename', () => {
    expect(isValidName('12345678901')).toBe(false);
  });

  it('should reject filename containing wildcards', () => {
    expect(isValidName('ABC*')).toBe(false);
    expect(isValidName('ABC*')).toBe(false);
  });
});

describe('ecopath.isValidWildcardName', () => {
  it('should accept valid filenames', () => {
    expect(isValidWildcardName('A')).toBe(true);
    expect(isValidWildcardName('a')).toBe(true);
    expect(isValidWildcardName('0')).toBe(true);
    expect(isValidWildcardName('9')).toBe(true);
    expect(isValidWildcardName('1234567890')).toBe(true);
    expect(isValidWildcardName('!BOOT')).toBe(true);
    expect(isValidWildcardName('ABC*')).toBe(true);
    expect(isValidWildcardName('A#C')).toBe(true);
  });

  it('should reject empty filename', () => {
    expect(isValidWildcardName('')).toBe(false);
  });

  it('should reject too-long filename', () => {
    expect(isValidWildcardName('12345678901')).toBe(false);
  });
});

describe('ecopath.parseDirBase', () => {
  it('should parse disc name', () => {
    expect(parseDirBase(':')).toEqual({
      dirBase: ':',
      discName: undefined,
    });
    expect(parseDirBase('$')).toEqual({
      dirBase: '$',
      discName: undefined,
    });
    expect(parseDirBase(':A')).toEqual({
      dirBase: ':A',
      discName: 'A',
    });
    expect(parseDirBase('$A')).toEqual({
      dirBase: '$A',
      discName: 'A',
    });
  });

  it('should parse relative-to-current', () => {
    expect(parseDirBase('@')).toEqual({
      dirBase: '@',
      discName: undefined,
    });
  });

  it('should parse relative-to-URD', () => {
    expect(parseDirBase('&')).toEqual({
      dirBase: '&',
      discName: undefined,
    });
  });

  it('should parse relative-to-parent', () => {
    expect(parseDirBase('^')).toEqual({
      dirBase: '^',
      discName: undefined,
    });
  });

  it('should not parse relative when extra chars included', () => {
    expect(parseDirBase('@ABC')).toBeUndefined();
    expect(parseDirBase('&ABC')).toBeUndefined();
    expect(parseDirBase('^ABC')).toBeUndefined();
  });
});

describe('ecopath.parseDirSpecifier', () => {
  it('should parse relative-to-root', () => {
    expect(parseFileSpecifier(':')).toEqual({
      dirBase: ':',
      discName: undefined,
      pathParts: [],
      dirname: ':',
      basename: undefined,
    });
    expect(parseFileSpecifier('$')).toEqual({
      dirBase: '$',
      discName: undefined,
      pathParts: [],
      dirname: '$',
      basename: undefined,
    });
    expect(parseFileSpecifier('@')).toEqual({
      dirBase: '@',
      discName: undefined,
      pathParts: [],
      dirname: '@',
      basename: undefined,
    });
  });

  it('should parse disc name', () => {
    expect(parseFileSpecifier(':ABC')).toEqual({
      dirBase: ':ABC',
      discName: 'ABC',
      pathParts: [],
      dirname: ':ABC',
      basename: undefined,
    });
    expect(parseFileSpecifier('$ABC')).toEqual({
      dirBase: '$ABC',
      discName: 'ABC',
      pathParts: [],
      dirname: '$ABC',
      basename: undefined,
    });
  });

  it('should parse simple dir name', () => {
    expect(parseFileSpecifier('ABC')).toEqual({
      dirBase: undefined,
      discName: undefined,
      pathParts: [],
      dirname: undefined,
      basename: 'ABC',
    });
  });

  it('should parse disc and simple dir name', () => {
    expect(parseFileSpecifier(':ABC.DEF')).toEqual({
      dirBase: ':ABC',
      discName: 'ABC',
      pathParts: [],
      dirname: ':ABC',
      basename: 'DEF',
    });
  });

  it('should parse single path entry with subdir', () => {
    expect(parseFileSpecifier('ABC.DEF')).toEqual({
      dirBase: undefined,
      discName: undefined,
      pathParts: ['ABC'],
      dirname: 'ABC',
      basename: 'DEF',
    });
  });

  it('should parse two path entries with further subdir', () => {
    expect(parseFileSpecifier('ABC.DEF.GHI')).toEqual({
      dirBase: undefined,
      discName: undefined,
      pathParts: ['ABC', 'DEF'],
      dirname: 'ABC.DEF',
      basename: 'GHI',
    });
  });

  it('should parse disc specifer, two path entries and further subdir', () => {
    expect(parseFileSpecifier('$MYDISK.ABC.DEF.GHI')).toEqual({
      dirBase: '$MYDISK',
      discName: 'MYDISK',
      pathParts: ['ABC', 'DEF'],
      dirname: '$MYDISK.ABC.DEF',
      basename: 'GHI',
    });
  });

  it('should handle no file specifier (wildcard filename)', () => {
    expect(parseFileSpecifier('$MYDISK.ABC.DEF.')).toEqual({
      dirBase: '$MYDISK',
      discName: 'MYDISK',
      pathParts: ['ABC', 'DEF'],
      dirname: '$MYDISK.ABC.DEF',
      basename: '',
    });
  });

  it('should handle star file specifier (wildcard filename)', () => {
    expect(parseFileSpecifier('$MYDISK.ABC.DEF.*')).toEqual({
      dirBase: '$MYDISK',
      discName: 'MYDISK',
      pathParts: ['ABC', 'DEF'],
      dirname: '$MYDISK.ABC.DEF',
      basename: '*',
    });
  });

  it('should handle star file specifier (partial wildcard filename)', () => {
    expect(parseFileSpecifier('$MYDISK.ABC.DEF.GH*')).toEqual({
      dirBase: '$MYDISK',
      discName: 'MYDISK',
      pathParts: ['ABC', 'DEF'],
      dirname: '$MYDISK.ABC.DEF',
      basename: 'GH*',
    });
  });

  it('should handle hash file specifier (single char wildcard)', () => {
    expect(parseFileSpecifier('$MYDISK.ABC.DEF.G#I')).toEqual({
      dirBase: '$MYDISK',
      discName: 'MYDISK',
      pathParts: ['ABC', 'DEF'],
      dirname: '$MYDISK.ABC.DEF',
      basename: 'G#I',
    });
  });

  it('should throw error on invalid disc name', () => {
    expect(() => parseFileSpecifier('$MYD;SK.ABC.DEF.GHI')).toThrow(
      "Invalid disc name 'MYD;SK'",
    );
  });

  it('should throw error on invalid path path', () => {
    expect(() => parseFileSpecifier('$MYDISK.A£C.DEF.GHI')).toThrow(
      "Invalid path part 'A£C'",
    );
  });
});

describe('ecopath.isWildcardMatch', () => {
  it('should match exact filename', () => {
    expect(isWildcardMatch('ABC', 'ABC')).toBe(true);
  });

  it('should match single char whildcard', () => {
    expect(isWildcardMatch('A#C', 'ABC')).toBe(true);
  });

  it('should match multi-char whildcard', () => {
    expect(isWildcardMatch('A*', 'ABC')).toBe(true);
  });

  it('should match mixed single/multi-char whildcard', () => {
    expect(isWildcardMatch('A#C*', 'ABCD')).toBe(true);
  });

  it('should fail mixed single/multi-char whildcard', () => {
    expect(isWildcardMatch('B#C*', 'ABCD')).toBe(false);
  });

  it('should fail multi-char whildcard', () => {
    expect(isWildcardMatch('A*', 'BBC')).toBe(false);
  });

  it('should fail exact filename match', () => {
    expect(isWildcardMatch('ABC', 'ABD')).toBe(false);
  });
});
