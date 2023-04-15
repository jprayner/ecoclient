# ecoclient

Command-line utility for performing Econet operations from a PC (Windows, Mac or Linux) using [Piconet](https://github.com/jprayner/piconet) hardware.

## Demo

https://user-images.githubusercontent.com/909745/232258349-4265b6ee-eec4-48df-9a95-ce5fbe2d8006.mp4

## Prerequisites

The following are required to use ecoclient:

- Node v.14+
- NPM v.6+

## Installation & configuration

```
npm install -g @jprayner/ecoclient
ecoclient set-fs 1          # required if your fileserver is not 254
ecoclient set-station 32    # an unassigned station number on you local Econet network
```

## Commands

### set-fs <station>

Sets the fileserver station number. Defaults to 254.

| Argument | Description |
|----------|-------------|
| station  | Fileserver station number in range 1-254 |

Exmaple:

```
ecoclient set-fs 1
```
  
## set-station <station>
  
Sets the local station number. Must be configured before using other commands (except `setXXX` and `monitor`).

| Argument | Description |
|----------|-------------|
| station  | Local station number in range 1-254 |

Exmaple:

```
ecoclient set-station 32
```

## notify <station> <message>

Sends a notification message to a station like a `*NOTIFY` command.

| Argument | Description |
|----------|-------------|
| station  | Station number to send a message to in range 1-254 |
| message  | The text of the message (may include a \r to execute a command) |

## monitor

Listen for network traffic like a "*NETMON" command. However, better than `*NETMON`, this command will dump _every single_ byte of a packet.

Exmaple:

```
ecoclient monitor
```

## i-am <username> [password]
  
Login to fileserver like a `*I AM` command. Directory handles (e.g. current directory) are persisted such that they take effect with other commands like `dir`.

| Argument | Description |
|----------|-------------|
| username  | Username registered known to the fileserver |
| password  | Password which corresponds to `username` |

Exmaple:

```
ecoclient i-am JPR93 MYPASS
```

## bye

Logout of the fileserver like a `*BYE` command.

Exmaple:

```
ecoclient bye
```
  
  
  bye [options]                           logout of fileserver like a "*BYE" command
  dir [options] [dir]                     change current directory
  get [options] <filename>                get file from fileserver using "LOAD" command
  put [options] <filename>                get file from fileserver using "SAVE" command
  load [options] <filename>               load basic file and detokenise (needs basictool installed)
  save [options] <localPath> [destPath]   save basic file after detokenising (needs basictool
                                          installed)
  cat [options] [dirPath]                 get catalogue of directory from fileserver
  cdir [options] <dirPath>                create directory on fileserver
  delete [options] <path>                 delete file on fileserver
  access [options] <path> <accessString>  set access on fileserver
