fastlane documentation
----

# Installation

Make sure you have the latest version of the Xcode command line tools installed:

```sh
xcode-select --install
```

For _fastlane_ installation instructions, see [Installing _fastlane_](https://docs.fastlane.tools/#installing-fastlane)

# Available Actions

## iOS

### ios build

```sh
[bundle exec] fastlane ios build
```

Build web, sync Capacitor, and archive a signed App Store IPA

### ios info

```sh
[bundle exec] fastlane ios info
```

Report the app's current state in App Store Connect (read-only)

### ios create_app

```sh
[bundle exec] fastlane ios create_app
```

Create the App Store Connect record (run once, only if the app does not exist yet)

### ios release

```sh
[bundle exec] fastlane ios release
```

Upload binary + metadata + screenshots and submit for review

### ios metadata_only

```sh
[bundle exec] fastlane ios metadata_only
```

Push metadata + screenshots only (no binary)

----


## Android

### android build

```sh
[bundle exec] fastlane android build
```

Build a signed release AAB

### android release

```sh
[bundle exec] fastlane android release
```

Upload AAB + listing to Play (only works after the first manual release)

----

This README.md is auto-generated and will be re-generated every time [_fastlane_](https://fastlane.tools) is run.

More information about _fastlane_ can be found on [fastlane.tools](https://fastlane.tools).

The documentation of _fastlane_ can be found on [docs.fastlane.tools](https://docs.fastlane.tools).
