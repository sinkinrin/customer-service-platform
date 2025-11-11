/**
 * Script to check customer user's group permissions in Zammad
 */

const ZAMMAD_URL = 'http://172.16.40.22:8080';
const ZAMMAD_API_TOKEN = 'gfgNF40pP1WjbDBMM9Jftwi2UIgOt9fze9WiNy3kxSb5akK4-mcV1F3ef3fJZ3Zt';

async function checkCustomerUser() {
  try {
    // Get customer user by email
    const searchResponse = await fetch(
      `${ZAMMAD_URL}/api/v1/users/search?query=customer@test.com`,
      {
        headers: {
          'Authorization': `Token token=${ZAMMAD_API_TOKEN}`,
          'Content-Type': 'application/json',
        },
      }
    );

    if (!searchResponse.ok) {
      throw new Error(`Search failed: ${searchResponse.statusText}`);
    }

    const users = await searchResponse.json();
    console.log('Search results:', JSON.stringify(users, null, 2));

    if (users.length === 0) {
      console.log('Customer user not found in Zammad');
      return;
    }

    const customerUser = users[0];
    console.log('\n=== Customer User Details ===');
    console.log(`ID: ${customerUser.id}`);
    console.log(`Email: ${customerUser.email}`);
    console.log(`First Name: ${customerUser.firstname}`);
    console.log(`Last Name: ${customerUser.lastname}`);
    console.log(`Role IDs: ${JSON.stringify(customerUser.role_ids)}`);
    console.log(`Group IDs: ${JSON.stringify(customerUser.group_ids)}`);
    console.log(`Active: ${customerUser.active}`);

    // Get detailed user info
    const userResponse = await fetch(
      `${ZAMMAD_URL}/api/v1/users/${customerUser.id}`,
      {
        headers: {
          'Authorization': `Token token=${ZAMMAD_API_TOKEN}`,
          'Content-Type': 'application/json',
        },
      }
    );

    if (!userResponse.ok) {
      throw new Error(`Get user failed: ${userResponse.statusText}`);
    }

    const userDetails = await userResponse.json();
    console.log('\n=== Detailed User Info ===');
    console.log(JSON.stringify(userDetails, null, 2));

    // Check if user has access to group ID 1 (Users group)
    if (userDetails.group_ids) {
      const hasGroup1 = Object.keys(userDetails.group_ids).includes('1');
      console.log(`\n=== Group Access Check ===`);
      console.log(`Has access to group ID 1 (Users): ${hasGroup1}`);
      
      if (!hasGroup1) {
        console.log('\n⚠️  ISSUE FOUND: Customer user does NOT have access to group ID 1 (Users group)');
        console.log('This is why tickets in group 1 are not visible to the customer.');
        console.log('\nRecommended fix: Add group ID 1 to customer user\'s group_ids');
      } else {
        console.log('\n✅ Customer user has access to group ID 1');
      }
    } else {
      console.log('\n⚠️  ISSUE FOUND: Customer user has NO group_ids assigned');
      console.log('This is why tickets are not visible to the customer.');
      console.log('\nRecommended fix: Assign group ID 1 to customer user');
    }

    // Search for tickets in group 1
    console.log('\n=== Searching for tickets in group ID 1 ===');
    const ticketSearchResponse = await fetch(
      `${ZAMMAD_URL}/api/v1/tickets/search?query=group_id:1`,
      {
        headers: {
          'Authorization': `Token token=${ZAMMAD_API_TOKEN}`,
          'Content-Type': 'application/json',
        },
      }
    );

    if (ticketSearchResponse.ok) {
      const tickets = await ticketSearchResponse.json();
      console.log(`Found ${tickets.length} tickets in group ID 1`);
      
      if (tickets.length > 0) {
        console.log('\nTickets in group 1:');
        tickets.slice(0, 5).forEach((ticket: any) => {
          console.log(`  - Ticket #${ticket.number}: ${ticket.title} (customer_id: ${ticket.customer_id})`);
        });
      }
    }

    // Search for tickets with X-On-Behalf-Of
    console.log('\n=== Searching with X-On-Behalf-Of ===');
    const xOnBehalfOfResponse = await fetch(
      `${ZAMMAD_URL}/api/v1/tickets/search?query=customer@test.com`,
      {
        headers: {
          'Authorization': `Token token=${ZAMMAD_API_TOKEN}`,
          'X-On-Behalf-Of': 'customer@test.com',
          'Content-Type': 'application/json',
        },
      }
    );

    if (xOnBehalfOfResponse.ok) {
      const xTickets = await xOnBehalfOfResponse.json();
      console.log(`Found ${xTickets.length} tickets with X-On-Behalf-Of`);
      
      if (xTickets.length > 0) {
        console.log('\nTickets found with X-On-Behalf-Of:');
        xTickets.slice(0, 5).forEach((ticket: any) => {
          console.log(`  - Ticket #${ticket.number}: ${ticket.title} (group_id: ${ticket.group_id})`);
        });
      } else {
        console.log('⚠️  No tickets found with X-On-Behalf-Of - this confirms the visibility issue');
      }
    }

  } catch (error) {
    console.error('Error:', error);
  }
}

checkCustomerUser();

