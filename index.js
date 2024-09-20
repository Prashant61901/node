const express = require('express');
const sql = require('mssql');
const app = express();

// Middleware
app.use(express.json());

// SQL Server configuration with connection pooling
const dbConfig = {
    user: 'urbanwada', // Update with your SQL Server username
    password: 'Admin@1845', // Update with your SQL Server password
    server: 'urbanwada.database.windows.net', // Azure SQL Server address
    database: 'urbanwada', // Your database name
    options: {
        encrypt: true, // This is needed for Azure SQL
        trustServerCertificate: false, // Ensure it's false for production unless needed
        connectionTimeout: 30000, // Increase connection timeout to 30 seconds
        requestTimeout: 30000, // Increase request timeout to 30 seconds
    },
    pool: {
        max: 10, // Maximum number of connections in the pool
        min: 0,  // Minimum number of connections in the pool
        idleTimeoutMillis: 30000 // Close idle connections after 30 seconds
    }
};

// Function to connect with retry logic
async function connectWithRetry() {
    let retries = 5;
    while (retries) {
        try {
            await sql.connect(dbConfig);
            console.log('Connected to SQL Server');
            break; // Exit loop on successful connection
        } catch (err) {
            console.error('Database connection failed:', err);
            retries -= 1;
            console.log(`Retrying connection (${5 - retries}/5)`);
            if (retries === 0) {
                console.error('Could not connect to SQL Server after multiple attempts.');
                throw err;
            }
            // Wait for 5 seconds before retrying
            await new Promise(res => setTimeout(res, 5000));
        }
    }
}

// Call the function to establish connection with retry
connectWithRetry();

// POST API to add new user tracking
app.post('/api/user_tracking', async (req, res) => {
    const { agent_id, user_name, longitude, latitude, tracking_time } = req.body;
    try {
        const request = new sql.Request();
        const query = `INSERT INTO user_tracking (agent_id, user_name, longitude, latitude, tracking_time) 
                       VALUES (@agent_id, @user_name, @longitude, @latitude, @tracking_time)`;

        request.input('agent_id', sql.Int, agent_id);
        request.input('user_name', sql.NVarChar(100), user_name);
        request.input('longitude', sql.Float, longitude);
        request.input('latitude', sql.Float, latitude);
        request.input('tracking_time', sql.DateTime, tracking_time);

        await request.query(query);
        res.status(201).send('User tracking added successfully');
    } catch (err) {
        console.error('Error inserting user tracking:', err);
        res.status(500).send(`Server error: ${err.message}`);
    }
});

// GET API to get agent info and the latest user tracking entry
app.get('/api/agent/:id', async (req, res) => {
    const agentId = req.params.id;
    try {
        const agentResult = await sql.query`SELECT * FROM agent WHERE agent_id = ${agentId}`;
        const trackingResult = await sql.query`SELECT TOP 1 * FROM user_tracking WHERE agent_id = ${agentId} ORDER BY tracking_time DESC`;

        const agent = agentResult.recordset[0];
        const latestTracking = trackingResult.recordset[0];

        if (!agent) {
            return res.status(404).send('Agent not found');
        }

        res.json({ agent, latestTracking });
    } catch (err) {
        console.error('Error fetching data:', err);
        res.status(500).send(`Server error: ${err.message}`);
    }
});

// Start the server
const port = 8080;
app.listen(port, () => {
    console.log(`Server running on port ${port}`);
});
