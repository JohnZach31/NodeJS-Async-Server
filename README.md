# NodeJS Async Server — Expense Tracker Backend

A Node.js backend project that implements an asynchronous, multi-service expense tracking system using **Express**, **MongoDB**, **Mongoose**, and **Pino** logging.

The project is organized into four independent Express services. Each service runs on its own port, connects to MongoDB, exposes a focused set of API endpoints, and stores request logs for tracking and debugging.

---

## Table of Contents

- [Project Overview](#project-overview)
- [Architecture](#architecture)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Services](#services)
- [API Endpoints](#api-endpoints)
- [Database Models](#database-models)
- [Computed Report Design Pattern](#computed-report-design-pattern)
- [Request Logging](#request-logging)
- [Environment Variables](#environment-variables)
- [Installation](#installation)
- [Running the Project](#running-the-project)
- [Testing](#testing)
- [Seeding the Database](#seeding-the-database)
- [Example Requests](#example-requests)
- [License](#license)

---

## Project Overview

This project is an academic backend assignment built around a cost management system.

The system supports:

- Creating users
- Adding cost items for existing users
- Generating monthly cost reports
- Returning developer information
- Saving request logs for every service
- Caching old monthly reports using the Computed Design Pattern

The backend is divided into separate services to keep responsibilities clear and to demonstrate a simple service-based architecture.

---

## Architecture

The project contains four Express servers:

| Server | Service Name | Default Port | Responsibility |
|---|---:|---:|---|
| `server1.js` | `logs-service` | `3001` | Returns saved request logs |
| `server2.js` | `users-service` | `3002` | Creates and reads users |
| `server3.js` | `costs-service` | `3003` | Adds costs and generates reports |
| `server4.js` | `about-service` | `3004` | Returns project developer details |

Each service connects to the same MongoDB database and uses shared Mongoose models.

---

## Tech Stack

- **Node.js**
- **Express**
- **MongoDB**
- **Mongoose**
- **Pino**
- **dotenv**
- **Node Test Runner**

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
├── .env.example
├── .gitignore
├── db.js
├── package.json
├── server1.js
├── server2.js
├── server3.js
├── server4.js
└── README.md