# CHANGELOG.md

## 2.0.15 (2023-07-18)

Fixes:

- None

Features:

- Add NEWUSER, REMUSER, PASS and PRIV commands

## 2.0.14 (2023-07-16)

Fixes:

- Fix failure to fetch small files in some circumstances (<1 block)
- Cope with 6-digit load/execution addresses a la BeebEm (thanks KenLowe!)
- Don't include path in .inf files when GETting

Features:

- ISS-6 Add recursive GET/PUT

## 2.0.12 (2023-06-17)

Fixes:

- Correct output of ecoclient help for put command (thanks jubber!)

Features:

- None

## 2.0.11 (2023-06-17)

Fixes:

- Add set-metadata config option

Features:

- None

## 2.0.10 (2023-06-11)

Fixes:

- Don't show save error unless retry fails

Features:

- None

## 2.0.9 (2023-06-11)

Fixes:

- Hide board errors unless debug turned on

Features:

- None

## 2.0.8 (2023-06-11)

Fixes:

- Add save retries

Features:

- None

## 2.0.7 (2023-06-07)

Fixes:

- Increase CAT timeout from 2s to 30s

Features:

- None

## 2.0.6 (2023-06-04)

Fixes:

- Deprecate waitForEvent (and stop using internally) due to timing issues

Features:

- Add toString() implementation to all error classes for easier logging

## 2.0.5 (2023-06-02)

Fixes:

- Fix command-line option processing

Features:

- Add saveThrottleMs option (default 200ms) to ~/.ecoclient/config.json to improve reliability with certain servers
- Add --debug command-line option to see what's happening between board and driver

## 2.0.4 (2023-05-29)

Fixes:

- None

Features:

- First public release
