const assert = require('node:assert/strict');
const test = require('node:test');

const adminUrl = process.env.ADMIN_BASE_URL || 'http://localhost:3001';
const usersUrl = process.env.USERS_BASE_URL || 'http://localhost:3002';
const costsUrl = process.env.COSTS_BASE_URL || 'http://localhost:3003';
const aboutUrl = process.env.ABOUT_BASE_URL || 'http://localhost:3004';

// Sends JSON requests and returns status plus parsed body.
const requestJson = async (url, options = {}) => {
  const response = await fetch(url, {
    headers: { 'content-type': 'application/json' },
    ...options,
  });

  // Every endpoint in this project returns JSON.
  const body = await response.json();
  return { response, body };
};

test('GET /api/about returns only developer names', async () => {
  const { response, body } = await requestJson(`${aboutUrl}/api/about/`);

  // The about endpoint should expose only team member names.
  assert.equal(response.status, 200);
  assert.ok(Array.isArray(body));
  assert.ok(body.length >= 1);
  assert.deepEqual(Object.keys(body[0]).sort(), ['first_name', 'last_name']);
});

test('POST /api/add rejects creating a duplicate user', async () => {
  const id = Date.now() + 100;
  const user = {
    id,
    first_name: 'duplicate',
    last_name: 'user',
    birthday: '2000-01-01',
  };

  const firstResponse = await requestJson(`${usersUrl}/api/add/`, {
    method: 'POST',
    body: JSON.stringify(user),
  });

  assert.equal(firstResponse.response.status, 201);

  const duplicateResponse = await requestJson(`${usersUrl}/api/add/`, {
    method: 'POST',
    body: JSON.stringify(user),
  });

  assert.equal(duplicateResponse.response.status, 409);
  assert.ok(duplicateResponse.body.id);
  assert.ok(duplicateResponse.body.message);
});

// User creation and lookup are tested together.
test('POST /api/add creates a user and GET /api/users/:id returns total', async () => {
  const id = Date.now();
  // Use a unique id so repeated test runs do not conflict.
  // User fields match the users collection schema.
  const user = {
    id,
    first_name: 'test',
    last_name: 'user',
    birthday: '2000-01-01',
  };

  // Create a unique user for this test run.
  const created = await requestJson(`${usersUrl}/api/add/`, {
    method: 'POST',
    body: JSON.stringify(user),
  });

  assert.equal(created.response.status, 201);
  assert.equal(created.body.id, id);

  // The summary endpoint should show total costs.
  // Fetch the user summary after creation.
  const details = await requestJson(`${usersUrl}/api/users/${id}`);

  assert.equal(details.response.status, 200);
  assert.equal(details.body.id, id);
  assert.equal(details.body.first_name, 'test');
  assert.equal(details.body.last_name, 'user');
  assert.equal(details.body.total, 0);
});

// Users list is a separate endpoint.
test('GET /api/users returns an array of users', async () => {
  // This endpoint belongs to the users process.
  const { response, body } = await requestJson(`${usersUrl}/api/users/`);

  // Users list endpoint should return JSON array.
  assert.equal(response.status, 200);
  assert.ok(Array.isArray(body));
});

test('GET /api/users/:id returns JSON error for a missing user', async () => {
  const { response, body } = await requestJson(
    `${usersUrl}/api/users/${Date.now() + 200000}`
  );

  assert.equal(response.status, 404);
  assert.ok(body.id);
  assert.ok(body.message);
});

// Cost creation and report generation are tested together.
test('POST /api/add creates a cost and GET /api/report groups it', async () => {
  // This id is unique for the cost flow test.
  const id = Date.now() + 1;
  const now = new Date();
  // Use UTC values to match report filtering on the server.
  const year = now.getUTCFullYear();
  const month = now.getUTCMonth() + 1;

  // The cost service requires the user to exist first.
  await requestJson(`${usersUrl}/api/add/`, {
    method: 'POST',
    // The user is created inside the users process.
    body: JSON.stringify({
      id,
      first_name: 'cost',
      last_name: 'tester',
      birthday: '2000-01-01',
    }),
  });

  // Add one cost item without a date so the server uses the current date.
  const createdCost = await requestJson(`${costsUrl}/api/add/`, {
    method: 'POST',
    // The cost body follows the costs collection fields.
    body: JSON.stringify({
      userid: id,
      description: 'milk',
      category: 'food',
      sum: 8,
    }),
  });

  assert.equal(createdCost.response.status, 201);
  assert.equal(createdCost.body.userid, id);
  assert.equal(createdCost.body.category, 'food');

  // Report request uses query-string parameters.
  // Request the report for the same month as the new cost.
  // The current month report should include the cost above.
  const report = await requestJson(
    `${costsUrl}/api/report/?id=${id}&year=${year}&month=${month}`
  );

  assert.equal(report.response.status, 200);
  assert.equal(report.body.userid, id);
  // The report costs field must be an array by the spec.
  assert.ok(Array.isArray(report.body.costs));
  assert.deepEqual(
    report.body.costs.map((group) => Object.keys(group)[0]),
    ['food', 'education', 'health', 'housing', 'sports']
  );

  const foodGroup = report.body.costs.find((group) => group.food);

  // Food group must exist and include the test cost.
  assert.ok(foodGroup);
  assert.ok(foodGroup.food.some((cost) => cost.description === 'milk'));
});

test('POST /api/add rejects cost for a non-existing user', async () => {
  const result = await requestJson(`${costsUrl}/api/add/`, {
    method: 'POST',
    body: JSON.stringify({
      userid: Date.now() + 500000,
      description: 'ghost cost',
      category: 'food',
      sum: 15,
    }),
  });

  assert.equal(result.response.status, 404);
  assert.ok(result.body.id);
  assert.ok(result.body.message);
});

// Invalid cost dates should produce JSON errors.
test('POST /api/add rejects past cost dates', async () => {
  // This id is unique for the validation test.
  const id = Date.now() + 2;

  // Create a user before testing cost validation.
  await requestJson(`${usersUrl}/api/add/`, {
    method: 'POST',
    // The validation test still needs an existing user.
    body: JSON.stringify({
      id,
      first_name: 'past',
      last_name: 'tester',
      birthday: '2000-01-01',
    }),
  });

  // Past cost dates are not allowed by the project document.
  const result = await requestJson(`${costsUrl}/api/add/`, {
    method: 'POST',
    // This body intentionally includes a past date.
    body: JSON.stringify({
      userid: id,
      description: 'old cost',
      category: 'food',
      sum: 10,
      date: '2000-01-01',
    }),
  });

  // The endpoint should reject the request before saving.
  // Error responses must include id and message.
  assert.equal(result.response.status, 400);
  assert.ok(result.body.id);
  assert.ok(result.body.message);
});

test('GET /api/report rejects invalid query values', async () => {
  const result = await requestJson(
    `${costsUrl}/api/report/?id=123123&year=2026&month=13`
  );

  assert.equal(result.response.status, 400);
  assert.ok(result.body.id);
  assert.ok(result.body.message);
});

// Logs process exposes all saved request logs.
test('GET /api/logs returns an array of log documents', async () => {
  // This endpoint belongs to the logs process.
  const { response, body } = await requestJson(`${adminUrl}/api/logs/`);

  // Logs endpoint should always return an array.
  assert.equal(response.status, 200);
  assert.ok(Array.isArray(body));
});
