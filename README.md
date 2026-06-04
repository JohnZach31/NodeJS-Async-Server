# NodeJS Async Server

A small backend project for managing users, costs, reports, and request logs.

Built with **Node.js**, **Express**, **MongoDB**, and **Mongoose**.

The project is split into a few tiny services instead of one giant server file, because apparently we like making our lives organized.

---

## What This Project Does

This backend lets you:

* Add users
* Add cost items for users
* Get monthly expense reports
* View request logs
* Return developer info

It also saves request logs to MongoDB, so every request can be tracked later.

---

## Tech Stack

* Node.js
* Express
* MongoDB
* Mongoose
* dotenv
* Pino logger
* Node test runner

---

## Project Structure

```txt
NodeJS-Async-Server/
├── models/
│   ├── Cost.js
│   ├── Log.js
│   └── User.js
├── scripts/
│   └── seed-imaginary-user.js
├── tests/
│   └── endpoints.test.js
├── db.js
├── server1.js
├── server2.js
├── server3.js
├── server4.js
├── package.json
├── .env.example
└── README.md
```

---

## Services

| File         |       Service |   Port | What it does                   |
| ------------ | ------------: | -----: | ------------------------------ |
| `server1.js` |  Logs service | `3001` | Shows saved request logs       |
| `server2.js` | Users service | `3002` | Adds and reads users           |
| `server3.js` | Costs service | `3003` | Adds costs and creates reports |
| `server4.js` | About service | `3004` | Shows developer information    |

Each service connects to the same MongoDB database.

---

## Main API Routes

### Logs

```http
GET /api/logs
```

Returns saved request logs.

---

### Users

```http
POST /api/add
GET /api/users
GET /api/users/:id
```

Example user:

```json
{
  "id": 123,
  "first_name": "John",
  "last_name": "Doe",
  "birthday": "2000-01-01"
}
```

---

### Costs

```http
POST /api/add
GET /api/report?id=123&year=2026&month=6
```

Example cost:

```json
{
  "userid": 123,
  "description": "Groceries",
  "category": "food",
  "sum": 80,
  "date": "2026-06-04"
}
```

Allowed categories:

```txt
food
health
housing
sports
education
```

---

### About

```http
GET /api/about
```

Returns the developer names from the `.env` file.

---

## Monthly Reports

The report endpoint groups costs by category for a specific user, year, and month.

Example:

```http
GET /api/report?id=123&year=2026&month=6
```

Old monthly reports can be saved and reused instead of recalculating everything again every time.

Because yes, even tiny projects deserve a little optimization arc.

---

## Environment Setup

Create a `.env` file in the root folder.

You can use `.env.example` as a base:

```env
MONGODB_URI=your_mongodb_connection_string

PORT1=3001
PORT2=3002
PORT3=3003
PORT4=3004

DEVELOPER1_FIRST_NAME=John
DEVELOPER1_LAST_NAME=Doe
```

Do not upload your real `.env` file to GitHub.

Seriously. MongoDB passwords do not belong on the internet.

---

## Installation

Clone the repo:

```bash
git clone https://github.com/JohnZach31/NodeJS-Async-Server.git
```

Enter the folder:

```bash
cd NodeJS-Async-Server
```

Install dependencies:

```bash
npm install
```

Create your `.env` file:

```bash
cp .env.example .env
```

Then edit `.env` with your real MongoDB connection string.

---

## Running the Project

Each server runs separately.

```bash
npm run server1
npm run server2
npm run server3
npm run server4
```

Usually, you would open a few terminal tabs and run one service in each tab.

---

## Running Tests

```bash
npm test
```

---

## Seed Data

To insert sample data:

```bash
npm run seed
```

---

## Example Flow

1. Start the users service.
2. Add a user.
3. Start the costs service.
4. Add a cost for that user.
5. Request a monthly report.
6. Check the logs service to see the recorded requests.

Tiny microservice-ish backend. Big student project energy.

---

## License

MIT
