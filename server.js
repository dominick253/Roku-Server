require('dotenv').config();

const express = require('express');
const cors = require('cors');
const fs = require('fs-extra');
const path = require('path');
const os = require('os');
const app = express();
const PORT = 3000;
const jsonFeedPath = path.join(__dirname, './output/roku_feed.json');
const helmet = require('helmet');

//added helmet, test to see if it works with roku still.
app.use(helmet());

app.use(cors({
    origin: '*',
    methods: ['GET', 'HEAD']
}));
//check test

// Serve static files from the 'Videos' directory
app.use('/Videos', express.static(path.join(__dirname, './Videos')));

// Serve static files from the 'output/thumbnails' directory
app.use('/output/thumbnails', express.static(path.join(__dirname, './output/thumbnails')));

// Endpoint to serve the JSON feed
app.get('/feed', async (req, res) => {
    console.log("/feed called")
    try {
        const data = await fs.readJson(jsonFeedPath);
        res.json(data);
    } catch (err) {
        res.status(500).json({ error: 'Error loading JSON feed.' });
    }
});

// Endpoint to stream video
app.get('/stream/:videoName', (req, res) => {
    console.log("/stream called")
    const videoName = decodeURIComponent(req.params.videoName); // Decode the video name
    console.log(`Requested video name: ${videoName}`); // Log the requested video name


    const videoPath = path.join(__dirname, './Videos', videoName);
    console.log(`Resolved video path: ${videoPath}`); // Log the resolved video path

    // res.setHeader('Content-Type', 'video/mp4');
    // res.sendFile(videoPath);

    // Check if the video file exists
    if (!fs.existsSync(videoPath)) {
        console.error('Video not found:', videoPath);
        return res.status(404).send('Video not found.');
    }
    // Log the video path for debugging
    console.log(`Requested video path: ${videoPath}`);

    // Check if the video file exists
    if (!fs.existsSync(videoPath)) {
        console.error('Video not found:', videoPath);
        return res.status(404).send('Video not found.');
    }

    const stat = fs.statSync(videoPath);
    const fileSize = stat.size;
    const range = req.headers.range;

    console.log(`File size: ${fileSize}`);
    console.log(`Range: ${range}`);

    // Set content type based on file extension
    const extname = path.extname(videoName).toLowerCase();
    let contentType = 'video/mp4'; // Default to MP4
    if (extname === '.mkv') {
        contentType = 'video/x-matroska'; // MKV content type
    }

    if (range) {
        const parts = range.replace(/bytes=/, '').split('-');
        const start = parseInt(parts[0], 10);
        const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;

        res.writeHead(206, {
            'Content-Range': `bytes ${start}-${end}/${fileSize}`,
            'Accept-Ranges': 'bytes',
            'Content-Length': end - start + 1,
            'Content-Type': contentType, // Use the determined content type
        });
        const stream = fs.createReadStream(videoPath, { start, end });
        stream.pipe(res);
    } else {
        res.writeHead(200, { 'Content-Length': fileSize, 'Content-Type': contentType });
        fs.createReadStream(videoPath).pipe(res);
    }
});



// Get the first available non-localhost IP address
function getLocalIPAddress() {
    const networkInterfaces = os.networkInterfaces();
    for (const interfaceName in networkInterfaces) {
        for (const iface of networkInterfaces[interfaceName]) {
            // Check if the interface is not a loopback address and is IPv4
            if (!iface.internal && iface.family === 'IPv4') {
                return iface.address;
            }
        }
    }
    return 'localhost'; // Fallback if no IP is found
}

const ipAddress = getLocalIPAddress();
app.listen(PORT, () => {
    console.log(`API server running at http://${ipAddress}:${PORT}`);
});
