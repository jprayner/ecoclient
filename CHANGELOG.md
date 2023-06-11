# CHANGELOG.md

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
