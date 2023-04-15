# ecoclient

Command-line utility for performing Econet operations using [Piconet](https://github.com/jprayner/piconet) hardware.

## Demo



## Prerequisites

The following are required to use ecoclient:

- Node v.14+
- NPM v.6+

## Instalation & configuration

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

  set-fs <station>                        set fileserver
  set-station <station>                   set Econet station
  notify [options] <station> <message>    send notification message to a station like a "*NOTIFY"
                                          command
  monitor [options]                       listen for network traffic like a "*NETMON" command
  i-am [options] <username> [password]    login to fileserver like a "*I AM" command
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


The following operations are supported:

- login/logout
- list directories
- upload/download files
- move/delete files
- update access rights
