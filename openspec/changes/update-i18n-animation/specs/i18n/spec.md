## ADDED Requirements

### Requirement: UI strings sourced from translations
#### Scenario: Rendering any customer/staff/admin page or shared UI component
- **WHEN** a string is displayed to the user (labels, buttons, toasts, placeholders, helper text)
- **THEN** it MUST come from the locale messages via the i18n layer (e.g., next-intl) and NOT be hardcoded in the component.

### Requirement: Locale selector uses translated names
#### Scenario: Opening the language selector
- **WHEN** locale options are shown
- **THEN** each option label comes from the translations for the current locale (e.g., `common.localeNames`) instead of hardcoded English names.
