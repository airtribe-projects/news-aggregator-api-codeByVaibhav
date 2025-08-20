# News Aggregator API

A fast, minimal REST API that supports user signup/login with JWT, user preferences management, and fetching personalized news from NewsAPI (with a safe local fallback).

## Highlights

- Node.js + Express
- Password hashing with bcrypt
- JWT authentication (Bearer token, 1h expiry)
- User preferences (in-memory store for demo/tests)
- News aggregation via NewsAPI using axios (optional; falls back to sample content without an API key)
- Thorough error handling and basic validation
- Fully tested with tap + supertest

---

## Quick Start

- Install dependencies

```bash
npm install
```

- Copy env template and configure (optional, see Env Vars)

```bash
cp .env.example .env
```

- Run tests

```bash
npm test
```

- Start the server (default port 3000)

```bash
npm start
```

- Health check

```bash
curl http://localhost:3000/
```

Expected: `{ "status": "ok" }`

---

## Requirements

- Node.js 18+
- Internet access only if you want real news from NewsAPI (optional)

---

## Environment Variables

- `PORT` (optional): Port to run the server on. Default: `3000`.
- `JWT_SECRET` (recommended): Secret for signing JWTs. Default: `dev_secret_change_me`.
- `NEWS_API_KEY` (optional): Your NewsAPI key. If not set, `/news` returns a stub response.

Use `.env.example` as a reference.

---

## Data Model (in-memory)

- Users are stored in memory for the session: `Map<email, { name, email, passwordHash, preferences: string[] }>`
- Passwords are stored as bcrypt hashes
- This is for demo/testing; restart clears all data

---

## Authentication Flow (Signup → Login → Authenticated Requests)

1) Signup
- Create a user with email and password (hashed on the server)

2) Login
- Exchange email and password for a JWT token

3) Use token
- Send `Authorization: Bearer <token>` on protected routes
- Token expires in 1 hour by default

### Bash examples

- Signup

```bash
curl -s -X POST \
	-H "Content-Type: application/json" \
	-d '{
				"name": "Clark Kent",
				"email": "clark@superman.com",
				"password": "Krypt()n8",
				"preferences": ["movies", "comics"]
			}' \
	http://localhost:3000/users/signup
```

- Login

```bash
# Extract token using Node.js
TOKEN=$(curl -s -X POST \
	-H "Content-Type: application/json" \
	-d '{ "email": "clark@superman.com", "password": "Krypt()n8" }' \
	http://localhost:3000/users/login | node -pe 'JSON.parse(require("fs").readFileSync(0, "utf8")).token')
echo "Token: $TOKEN"
```

- Authenticated request

```bash
curl -s \
	-H "Authorization: Bearer $TOKEN" \
	http://localhost:3000/users/preferences
```

---

## Endpoints

### Health Check
- GET `/`
- Response: `{ "status": "ok" }`

### Signup
- POST `/users/signup`
- Auth: None
- Body JSON:
	- `name` (string, optional)
	- `email` (string, required, valid email)
	- `password` (string, required, min 6 chars)
	- `preferences` (string[], optional; defaults to empty array)
- Responses:
	- 200 `{ "message": "Signup successful" }`
	- 400 `{ "error": "Email and password are required" | "Invalid email" | "Password too short" }`
	- 500 `{ "error": "Internal Server Error" }`
- Notes:
	- If signup is called multiple times with the same email, the last call overwrites the previous user in memory (demo behavior)

Example

```bash
curl -s -X POST \
	-H "Content-Type: application/json" \
	-d '{ "name": "Bruce Wayne", "email": "bruce@wayne.com", "password": "Batm@n123" }' \
	http://localhost:3000/users/signup
```

### Login
- POST `/users/login`
- Auth: None
- Body JSON:
	- `email` (string, required)
	- `password` (string, required)
- Responses:
	- 200 `{ "token": "<jwt>" }`
	- 401 `{ "error": "Invalid credentials" }`
	- 500 `{ "error": "Internal Server Error" }`

Example

```bash
curl -s -X POST \
	-H "Content-Type: application/json" \
	-d '{ "email": "bruce@wayne.com", "password": "Batm@n123" }' \
	http://localhost:3000/users/login
```

### Get Preferences
- GET `/users/preferences`
- Auth: Bearer token required
- Responses:
	- 200 `{ "preferences": ["..."] }`
	- 401 `{ "error": "Unauthorized" }`

Example

```bash
curl -s \
	-H "Authorization: Bearer $TOKEN" \
	http://localhost:3000/users/preferences
```

### Update Preferences
- PUT `/users/preferences`
- Auth: Bearer token required
- Body JSON:
	- `preferences` (string[], required)
- Responses:
	- 200 `{ "message": "Preferences updated" }`
	- 400 `{ "error": "preferences must be an array" }`
	- 401 `{ "error": "Unauthorized" }`

Example

```bash
curl -s -X PUT \
	-H "Content-Type: application/json" \
	-H "Authorization: Bearer $TOKEN" \
	-d '{ "preferences": ["movies", "comics", "games"] }' \
	http://localhost:3000/users/preferences
```

### Get News
- GET `/news`
- Auth: Bearer token required
- Behavior:
	- If `NEWS_API_KEY` is set, the server queries NewsAPI `/v2/everything` using up to the first 3 user preferences as a search query (`q` joined by `OR`). Returns first 10 results.
	- If `NEWS_API_KEY` is not set or the external call fails, returns a small, static stub: `{ news: [{ id, title, category }] }`.
- Responses:
	- 200 `{ "news": [{ id, title, source?, url?, category? }] }`
	- 401 `{ "error": "Unauthorized" }`

Example (without a key)

```bash
curl -s \
	-H "Authorization: Bearer $TOKEN" \
	http://localhost:3000/news
```

Example (with `NEWS_API_KEY` set)

```bash
curl -s \
	-H "Authorization: Bearer $TOKEN" \
	http://localhost:3000/news
```

---

## Validation and Error Handling

- Email validation: must be a simple `local@domain.tld` pattern
- Password: min length 6 characters
- Preferences: must be an array for `PUT /users/preferences`
- Auth: all protected routes require `Authorization: Bearer <token>`
- Errors
	- 400: invalid input or missing fields
	- 401: invalid/missing token or user not found
	- 500: unexpected errors

---

## Testing

- Run the full test suite

```bash
npm test
```

What’s covered
- Auth: signup, login, wrong password
- Preferences: get, update, auth required
- News: auth required, returns `{ news: [...] }`

---

## Notes & Limitations

- In-memory store: all data is cleared on restart
- No refresh tokens: JWTs expire after 1 hour
- Not production-grade security: demo defaults are used if env vars are not set
- NewsAPI free tier has rate limits; use sparingly

---

## Troubleshooting

- “Unsupported Node.js version” on test: install Node 18+
- 401 Unauthorized: ensure you pass `Authorization: Bearer <token>`
- Empty news or stub news: set `NEWS_API_KEY` and ensure outbound network access
- To capture tokens in bash without extra tools, use Node to parse JSON: `TOKEN=$(curl ... | node -pe 'JSON.parse(require("fs").readFileSync(0, "utf8")).token')`

---

## Future Enhancements

- Persistent storage (database) for users and preferences
- Caching of news results to reduce external API calls
- Article interactions (read/favorite) and search endpoints
- Stronger validation (zod/joi) and structured error responses
