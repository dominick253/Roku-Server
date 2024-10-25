const fs = require('fs');
const path = require('path');

// Directory containing the downloaded videos
const videosDir = '/home/dom/Roku-Server/Server/Videos';
// Archive file for yt-dlp
const archiveFilePath = '/home/dom/Roku-Server/Server/downloaded_videos.txt';

// Function to generate the archive file
const generateArchive = () => {
    // Ensure the output file exists
    if (!fs.existsSync(archiveFilePath)) {
        fs.writeFileSync(archiveFilePath, '', 'utf8');
    }

    // Read the videos directory
    fs.readdir(videosDir, (err, files) => {
        if (err) {
            console.error('Error reading videos directory:', err);
            return;
        }

        // Filter video files (you can adjust the extensions as needed)
        const videoFiles = files.filter(file => /\.(mp4|mkv|avi|mov)$/i.test(file));

        // Read existing archive content
        const existingArchiveContent = fs.readFileSync(archiveFilePath, 'utf8').split('\n');

        // Create a set for faster lookup
        const existingVideosSet = new Set(existingArchiveContent.filter(line => line));

        // Prepare new entries for the archive
        const newEntries = [];

        videoFiles.forEach(file => {
            const videoTitle = path.parse(file).name; // Extract the title without the extension
            // Add to new entries if not already in the archive
            if (!existingVideosSet.has(videoTitle)) {
                newEntries.push(videoTitle);
            }
        });

        // Append new entries to the archive
        if (newEntries.length > 0) {
            fs.appendFileSync(archiveFilePath, newEntries.join('\n') + '\n', 'utf8');
            console.log(`Added ${newEntries.length} new entries to the archive.`);
        } else {
            console.log('No new entries to add to the archive.');
        }
    });
};

// Run the function to generate the archive
generateArchive();
