const express = require('express');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const axios = require('axios');

require('dotenv').config();

const app = express();
const port = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'dev_secret_change_me';

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const users = new Map();

function createToken(payload) {
    return jwt.sign(payload, JWT_SECRET, { expiresIn: '1h' });
}

function authMiddleware(req, res, next) {
    const auth = req.headers['authorization'] || '';
    const [scheme, token] = auth.split(' ');
    if (scheme !== 'Bearer' || !token) {
        return res.status(401).json({ error: 'Unauthorized' });
    }
    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        const user = users.get(decoded.email);
        if (!user) return res.status(401).json({ error: 'Unauthorized' });
        req.user = user;
        next();
    } catch (e) {
        return res.status(401).json({ error: 'Unauthorized' });
    }
}

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

app.post('/users/signup', async (req, res) => {
    try {
        const { name, email, password, preferences } = req.body || {};
        if (!email || !password) {
            return res.status(400).json({ error: 'Email and password are required' });
        }
        if (!emailRegex.test(String(email))) {
            return res.status(400).json({ error: 'Invalid email' });
        }
        if (String(password).length < 6) {
            return res.status(400).json({ error: 'Password too short' });
        }
        const normalizedEmail = String(email).toLowerCase();
        const passwordHash = await bcrypt.hash(String(password), 10);
        const user = {
            name: name || '',
            email: normalizedEmail,
            passwordHash,
            preferences: Array.isArray(preferences) ? preferences : []
        };
        users.set(normalizedEmail, user);
        return res.status(200).json({ message: 'Signup successful' });
    } catch (err) {
        return res.status(500).json({ error: 'Internal Server Error' });
    }
});

app.post('/users/login', async (req, res) => {
    try {
        const { email, password } = req.body || {};
        const normalizedEmail = String(email || '').toLowerCase();
        const user = users.get(normalizedEmail);
        if (!user) return res.status(401).json({ error: 'Invalid credentials' });

        const ok = await bcrypt.compare(String(password || ''), user.passwordHash);
        if (!ok) return res.status(401).json({ error: 'Invalid credentials' });

        const token = createToken({ email: user.email });
        return res.status(200).json({ token });
    } catch (err) {
        return res.status(500).json({ error: 'Internal Server Error' });
    }
});

app.get('/users/preferences', authMiddleware, (req, res) => {
    return res.status(200).json({ preferences: req.user.preferences || [] });
});

app.put('/users/preferences', authMiddleware, (req, res) => {
    const { preferences } = req.body || {};
    if (!Array.isArray(preferences)) {
        return res.status(400).json({ error: 'preferences must be an array' });
    }
    req.user.preferences = preferences;
    users.set(req.user.email, req.user);
    return res.status(200).json({ message: 'Preferences updated' });
});

app.get('/news', authMiddleware, async (req, res) => {
    const apiKey = process.env.NEWS_API_KEY;

    if (!apiKey) {
        const sample = [{ id: '1', title: 'Sample headline', source: 'Sample source', url: 'https://example.com/sample-news' }];
        return res.status(200).json({ news: sample });
    }

    try {
        const prefs = Array.isArray(req.user.preferences) ? req.user.preferences : [];
        const q = prefs.length ? prefs.slice(0, 3).join(' OR ') : 'technology';
        const { data } = await axios.get('https://newsapi.org/v2/everything', {
            params: {
                q,
                language: 'en',
                sortBy: 'publishedAt',
                pageSize: 10
            },
            headers: { 'X-Api-Key': apiKey }
        });

        const news = Array.isArray(data?.articles)
            ? data.articles.map((a, idx) => ({
                id: String(idx + 1),
                title: a.title,
                source: a.source?.name,
                url: a.url
            }))
            : [];

        return res.status(200).json({ news });
    } catch (_err) {
        const sample = [{ id: '1', title: 'Sample headline', category: 'general' }];
        return res.status(200).json({ news: sample });
    }
});

app.get('/', (_req, res) => {
    res.json({ status: 'ok' });
});

if (require.main === module) {
    app.listen(port, (err) => {
        if (err) {
            return console.error('Something bad happened', err);
        }
        console.log(`Server is listening on ${port}`);
    });
}

module.exports = app;
