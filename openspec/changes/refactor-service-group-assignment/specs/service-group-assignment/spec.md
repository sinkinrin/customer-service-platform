## ADDED Requirements

### Requirement: Local Service Group Ownership Truth

The system SHALL persist customer service ownership in local database models `ServiceGroup` and `CustomerGroupAssignment`.

#### Scenario: Customer has one active service-group assignment

- **GIVEN** a customer has a `CustomerGroupAssignment`
- **WHEN** runtime ownership is resolved for ticket creation, email routing, or auth session enrichment
- **THEN** the system SHALL use the linked `ServiceGroup` as the only customer ownership truth

#### Scenario: Customer has no assignment

- **GIVEN** a customer has no `CustomerGroupAssignment`
- **WHEN** runtime ownership is resolved
- **THEN** the system SHALL treat the customer as unassigned
- **AND** the system SHALL NOT derive ownership from `note.Region`

### Requirement: Assignment Change Propagates To Active Work

The system SHALL propagate service-group ownership changes to the customer's non-closed tickets.

#### Scenario: Admin changes a customer's service group

- **GIVEN** a customer has non-closed tickets
- **WHEN** an admin changes that customer's `CustomerGroupAssignment`
- **THEN** the system SHALL migrate the customer's non-closed tickets to the new service-group owner and target base region

#### Scenario: Admin changes a service-group owner

- **GIVEN** a service group has assigned customers with non-closed tickets
- **WHEN** an admin changes the service group's owner
- **THEN** the system SHALL migrate those customers' non-closed tickets to the new owner

### Requirement: Unassigned Customers Use Explicit Staging Fallback

The system SHALL use staging and admin handling as the only fallback for unassigned customers or unavailable owners.

#### Scenario: Assigned owner is unavailable

- **GIVEN** a customer has a service-group assignment
- **AND** the assigned owner is unavailable for assignment
- **WHEN** the system handles a new ticket
- **THEN** the ticket SHALL remain in staging for admin handling
- **AND** the system SHALL NOT choose a replacement owner automatically
