# Changelog

## [1.5.1] - 2025-02-27

### Added

- Improved document lifecycle management with configurable expiration periods

### Changed

- Refactored document expiration date handling to centralize the logic in the `createPdfStoragePath` function
- Protocol documents now have a 24-hour expiration period while other documents maintain the default 30-day period
- Enhanced test coverage for expiration date handling

### Fixed

- Fixed inconsistent document expiration behaviors between different document types
- Improved error handling in service initialization

## [1.5.0] - 2025-02-24

### Added

- Watermark when print documents not in production
- Show the vat response message from VIES check on copy
- No vat causes if no vat tax is applied (EU)
- The watermark PNG
- Test for the watermark

### Changed

- Translations
- CSS
- Minor template structure

### Fixed

- All tests
- Template redundancy

## [1.4.0] - 2025-02-20

### Added

- More accurate invoice structure
- More accurate validation and error handling

### Changed

- Updated invoice and protocol templates
- Updated Bulgarian translations

### Fixed

- Fixed issue with signatures
- Fixed all tests

## [1.3.0] - 2025-02-20

### Added

- Dev server to preview templates

### Changed

- Updated invoice template
- Test suite for templates

## [1.2.0] - 2025-02-20

### Added

- Added Bulgarian translations

### Changed

- Updated invoice template

## [1.0.0] - 2025-02-16

### Added

- \n

### Changed

- \n
