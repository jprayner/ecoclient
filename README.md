# ecoclient

Command-line utility for performing Econet operations from a PC (Windows, Mac or Linux) using [Piconet](https://github.com/jprayner/piconet) hardware.

## Demo

![output](https://user-images.githubusercontent.com/909745/232258909-0cf166fe-fd94-4ec6-869f-3f87402a9f1e.gif)

## Prerequisites

The following are required to use ecoclient:

- A [Piconet board](https://github.com/jprayner/piconet)
- Node v.14+
- NPM v.6+

## Installation & configuration

```
npm install -g @jprayner/ecoclient
ecoclient set-fs 1          # required if your fileserver is not 254
ecoclient set-station 32    # an unassigned station number on you local Econet network
```

## State of development

This project is still under development. Currently:

- Most fileserver testing has been against a Level 3 (BBC) fileserver although a Level 4 fileserver (Archimedes) and [PiEconetBridge fileserver](https://github.com/cr12925/PiEconetBridge) have also been used. User testing suggests that an Acorn Filestore also works (with floppy disks).
- Most host OS testing has been performed on a Mac, although Linux and Windows have also been tried successfully.

## Commands

### set-fs [station]

Sets the fileserver station number. Defaults to 254.

| Argument | Description                              |
| -------- | ---------------------------------------- |
| station  | Fileserver station number in range 1-254 |

Example:

```
ecoclient set-fs 1
```

## set-station [station]

Sets the local station number. Must be configured before using other commands (except `setXXX` and `monitor`).

| Argument | Description                         |
| -------- | ----------------------------------- |
| station  | Local station number in range 1-254 |

Example:

```
ecoclient set-station 32
```

## notify [station] [message]

Sends a notification message to a station like a `*NOTIFY` command.

| Argument | Description                                                     |
| -------- | --------------------------------------------------------------- |
| station  | Station number to send a message to in range 1-254              |
| message  | The text of the message (may include a \r to execute a command) |

## monitor

Listen for network traffic like a "*NETMON" command. However, better than `*NETMON`, this command will dump _every single_ byte of a packet.

Example:

```
ecoclient monitor
```

## i-am [username] [password]

Login to fileserver like a `*I AM` command. Directory handles (e.g. current directory) are persisted such that they take effect with other commands like `dir`.

| Argument | Description                                  |
| -------- | -------------------------------------------- |
| username | Registered username, known to the fileserver |
| password | Password which corresponds to `username`     |

Example:

```
ecoclient i-am JPR93 MYPASS
```

## bye

Logout of the fileserver like a `*BYE` command.

Example:

```
ecoclient bye
```

## dir [directory]

Change current directory on fileserver like a `*DIR` command. Directory handles are persisted such that they take effect with subsequent commands like `get`, `put`, `load`, `save` or `dir`.

| Argument | Description                                                                                                                                                                |
| -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| dir      | New directory on fileserver. May be relative to current directory, prefixed with `$.` to change to a directory relative to the root etc. Omit to change to home directory. |

Examples:

```
ecoclient dir $.Library
ecoclient dir subdir
```

## get [pathPattern]

Download the specified file(s) to the current directory of the local host. Load and execution addresses are optionally persisted in the local filename or an `.inf` file (see `set-metadata` command).

The `*` wildcard matches multiple characters whereas the `?` wildcard matches a single character. Use the recurse option to copy directories.

| Option            | Description                                                    |
| ----------------- | -------------------------------------------------------------- |
| `--recurse`, `-r` | Recurse into matching directories.                             |
| `--force`, `-f`   | Force overwrite of pre-existing local files without prompting. |

| Argument    | Description                                                                                                                    |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------ |
| pathPattern | Name of remote file(s)/dir(s). May be relative to current directory, prefixed with `$.` if relative to the root directory etc. |

Examples:

```
ecoclient get MyFile
ecoclient get 'My*'
ecoclient get $.Games.MyFile
ecoclient get -r MyDir
ecoclient get -rf MyDir
```

## put [pathPattern]

Upload the specified file(s)/dir(s) from the host machine to the current directory on the server. Sets load/execution addresses if embedded in filename or found in a corresponding `.inf` file (see `set-metadata` command).

The `*` wildcard matches multiple characters whereas the `?` wildcard matches a single character. Use the recurse option to copy directories.

The contents of DFS disk images may be uploaded by specifying a file with a `.ssd` or `.dsd` extension.

| Option            | Description                                                     |
| ----------------- | --------------------------------------------------------------- |
| `--recurse`, `-r` | Recurse into matching directories.                              |
| `--force`, `-f`   | Force overwrite of pre-existing remote files without prompting. |

| Argument    | Description                                                                                                                   |
| ----------- | ----------------------------------------------------------------------------------------------------------------------------- |
| pathPattern | Name of local file(s)/dir(s). May be relative to current directory, prefixed with `$.` if relative to the root directory etc. |

Examples:

```
ecoclient put MyFile
ecoclient put 'My*'
ecoclient put Games/MyFile
ecoclient put -r MyDir
ecoclient put -rf MyDir
ecoclient put games.ssd
```

## load [filename]

Download the specified BASIC file from the server, use `basictool` to de-tokenise it and write it to a file on the local filesystem naned as `${filename}.bas`.

Assumes `basictool` is on the local machine's PATH.

| Argument | Description                                                                                                        |
| -------- | ------------------------------------------------------------------------------------------------------------------ |
| filename | Name of remote file. May be relative to current directory or prefixed with `$.` if relative to the root directory. |

Examples:

```
ecoclient load Menu
ecoclient get $.Games.Menu
```

## save [localPath] [destPath]

Utilises `basictool` to tokenize the specified plain-text BASIC file on the local filesystem and uploads the result to the server.

Assumes `basictool` is on the local machine's PATH.

| Argument            | Description                                                                |
| ------------------- | -------------------------------------------------------------------------- |
| localPath           | Path to local file.                                                        |
| [optional] destPath | Path to remote file. If ommitted, taken from filename in local `.inf` file |

Examples:

```
ecoclient save Menu
ecoclient save $.Games.Menu
```

## cat [dirPath]

Provides a file listing for the specified directory.

| Argument           | Description                                                                                                                                                                   |
| ------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [optional] dirPath | Directory path: may be relative to the current directory or prefixed with `$.` to list a directory relative to the fileserver root. If ommitted, lists the current directory. |

Examples:

```
ecoclient cat Subdir
ecoclient cat $.Games
```

## cdir [dirPath]

Creates a directory.

| Argument | Description                                                                                                                           |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| dirPath  | Directory path: may be relative to the current directory or prefixed with `$.` to create a directory relative to the fileserver root. |

Examples:

```
ecoclient cdir Subdir
ecoclient cdir $.Subdir
```

## delete [pathPattern]

Deletes the specified file(s) and dir(s).

The `*` wildcard matches multiple characters whereas the `?` wildcard matches a single character. Use the recurse option to delete directories.

| Option            | Description                                |
| ----------------- | ------------------------------------------ |
| `--recurse`, `-r` | Recurse into matching directories.         |
| `--force`, `-f`   | Force deletion of files without prompting. |

| Argument    | Description                                                                                                                    |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------ |
| pathPattern | Name of remote file(s)/dir(s). May be relative to current directory, prefixed with `$.` if relative to the root directory etc. |

Examples:

```
ecoclient delete MyFile
ecoclient delete --force MyFile
ecoclient delete -f MyFile
ecoclient delete $.Games.MyFile
ecoclient delete -f 'My*'
ecoclient delete --recurse 'MyDir'
ecoclient delete -rf 'MyDir'
```

## access [path] [accessString]

Set access rights for a file on the fileserver.

| Argument     | Description                                                                                                                                   |
| ------------ | --------------------------------------------------------------------------------------------------------------------------------------------- |
| path         | File or directory path: may be relative to the current directory or prefixed with `$.` to delete a directory relative to the fileserver root. |
| accessString | An Econet access string e.g. `WR/R`                                                                                                           |

Examples:

```
ecoclient access MyFile WR/
ecoclient access $.Games.MyFile WR/
```

## pass [oldPassword] [newPassword]

Change password for current user.

| Argument    | Description                                   |
| ----------- | --------------------------------------------- |
| oldPassword | Current password (or leave blank if none set) |
| newPassword | New password (or leave blank to remove)       |

Examples:

```
ecoclient pass MYPASS1 MYPASS2  # Normal use
ecoclient pass '' MYPASS        # Handy for newly-created accounts
ecoclient pass MYPASS ''        # Remove password
```

## newuser [username]

Create a new user.

| Argument | Description                                   |
| -------- | --------------------------------------------- |
| username | Username to be registered with the fileserver |

Example:

```
ecoclient newuser ethel
```

## remuser [username]

Remove an existing user.

| Argument | Description                                  |
| -------- | -------------------------------------------- |
| username | Registered username, known to the fileserver |

Example:

```
ecoclient remuser gertrude
```

## priv [username] [level]

Set privilege level for specified user.

| Argument | Description                                                                |
| -------- | -------------------------------------------------------------------------- |
| username | Registered username, known to the fileserver                               |
| level    | `S` == System, `N` (or ommit) == Normal, others are system/level-dependent |

Examples:

```
priv susan S   # let's be besties, have the keys to my front door
priv brian     # screw this guy, bust him down to private
priv adrian N  # screw this guy, bust him down to private
```
