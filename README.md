![Version](https://img.shields.io/github/package-json/v/toschaef/RomBox)
![RomBox CI](https://github.com/toschaef/RomBox/actions/workflows/ci.yaml/badge.svg)

# setup:

clone this repo and run the command

`npm ci; npm start`

## known issues:

the install modal persists on install error

version tag doesnt work because repo is private

the ci tag doesnt work because the tests are untracked

GroupBindingCard doesnt prevent event defaults (page scrolling on arrow key/space binds)

Azahar doesnt configure controller controls unless controller is connected on launch

azahar has update popup on launch


## todo:

### soon:

general settings (auto install engine, fullscreen, resolution)

multiplayer (local)

### future

save caching for 3ds, wii, n64

controller support on gc/wii, N64

keyboard support on N64

display game cover (aws lambda)

ui improvement

more consoles

emulator specific settings

theme customization

controller options per console

multiplayer support