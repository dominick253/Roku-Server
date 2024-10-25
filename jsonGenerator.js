require('dotenv').config();

const fs = require('fs-extra');
const path = require('path');
const ffmpeg = require('fluent-ffmpeg');
const url = process.env.URL;
const videosDirectory = './Videos';
const outputFile = path.join(__dirname, 'output', 'roku_feed.json');

async function generateJsonFeed() {
    try {
        const files = await fs.readdir(videosDirectory);
        let monthCategories = []; // Change to an array

        const movies = await Promise.all(
            files.map(async (file, index) => {
                const filePath = path.join(videosDirectory, file);
                const stats = await fs.stat(filePath);
                if (!stats.isFile() || !(filePath.endsWith('.mp4') || filePath.endsWith('.mkv'))) return null;

                const metadata = await getVideoMetadata(filePath);
                const duration = Math.floor(metadata.format.duration);
                console.log(`Duration for ${filePath}: ${metadata.format.duration}`);

                const title = path.parse(file).name
                    .replace(/[|｜]/g, ' ')   // Replace any form of vertical bar with a space
                    .replace(/[：]/g, ':');   // Replace full-width colon with a regular colon

                // Extract release date from title
                const releaseDate = extractReleaseDateFromTitle(title);
                const releaseDateObj = new Date(releaseDate);
                const monthYear = `${releaseDateObj.getFullYear()}-${(releaseDateObj.getMonth() + 1).toString().padStart(2, '0')}`; // Format: YYYY-MM

                // Generate the thumbnail and get its path
                const thumbnailPath = await generateThumbnail(filePath, title);

                // Determine category based on title
                let category = 'Sermons';
                if (title.includes('Sermon')) {
                    category = 'Sermons';
                } else if (title.includes('Event')) {
                    category = 'Events';
                }

                return {
                    id: `video${index}`,
                    title: title,
                    shortDescription: `Manteno Church Of The Nazarene ${title}.`,
                    thumbnail: encodeURI(`${url}/output/thumbnails/${title}.jpg`), // Encode the thumbnail URL
                    releaseDate: releaseDate,
                    releaseDateObj: releaseDateObj, // Keep track of the release date
                    genres: ["Religious"], // Update genres as needed
                    content: {
                        duration: duration,
                        videos: [
                            {
                                url: encodeURI(`${url}/stream/${path.basename(file)}`), // Keep original file name for the video URL
                                quality: "FHD",
                                videoType: path.extname(file).slice(1).toUpperCase(),
                            },
                        ],
                    },
                    dateAdded: new Date().toISOString(),
                };
            })
        );

        // Filter out null values and sort by releaseDate in descending order
        const sortedMovies = movies.filter(Boolean).sort((a, b) => b.releaseDateObj - a.releaseDateObj);

        // Organize movies into month-year categories
        sortedMovies.forEach(movie => {
            const monthYear = `${movie.releaseDateObj.getFullYear()}-${(movie.releaseDateObj.getMonth() + 1).toString().padStart(2, '0')}`; // Format: YYYY-MM
            const monthName = new Date(monthYear + '-01').toLocaleString('default', { month: 'long' });

            // Check if the month category already exists
            const existingCategory = monthCategories.find(cat => cat.monthYear === monthYear);
            if (!existingCategory) {
                monthCategories.push({ monthYear: monthYear, monthName: monthName, videos: [movie] }); // Add new month category
            } else {
                existingCategory.videos.push(movie); // Push video to existing month category
            }
        });

        // Sort videos within each month before adding to the feed
        monthCategories.forEach(category => {
            category.videos.sort((a, b) => new Date(b.releaseDate) - new Date(a.releaseDate)); // Sort videos by releaseDate in descending order
        });

        // Build the final feed object with sorted month categories
        const feed = {
            providerName: "Manteno Church Of The Nazarene: ",
            lastUpdated: new Date().toISOString(),
            language: "en",
        };

        // Add month categories to the feed in the correct order
        monthCategories.sort((a, b) => b.monthYear.localeCompare(a.monthYear)); // Ensure correct order by monthYear
        monthCategories.forEach(monthCategory => {
            // Create the category key as "Month Year"
            const categoryKey = `${monthCategory.monthName} ${monthCategory.monthYear.split('-')[0]}`;
            feed[categoryKey] = monthCategory.videos; // Add the videos for each month
        });

        await fs.outputJson(outputFile, feed, { spaces: 2 });
        console.log(`JSON feed generated: ${outputFile}`);
    } catch (err) {
        console.error(`Error generating JSON feed: ${err.message}`);
    }
}

async function generateThumbnail(filePath, title) {
    return new Promise((resolve, reject) => {
        const thumbnailPath = path.join(__dirname, 'output', 'thumbnails', `${title}.jpg`); // Save in thumbnails directory
        
        // Check if the thumbnail already exists
        if (fs.existsSync(thumbnailPath)) {
            console.log(`Thumbnail already exists: ${thumbnailPath}`);
            resolve(thumbnailPath); // Resolve with the existing thumbnail path
        } else {
            // Generate thumbnail if it doesn't exist
            ffmpeg(filePath)
                .on('end', () => {
                    console.log(`Thumbnail generated: ${thumbnailPath}`);
                    resolve(thumbnailPath);
                })
                .on('error', (err) => {
                    console.error(`Error generating thumbnail: ${err.message}`);
                    reject(err);
                })
                .screenshots({
                    timestamps: ['00:01:01.000'], // Get a frame at 1 second
                    filename: `${title}.jpg`,
                    folder: path.join(__dirname, 'output', 'thumbnails'), // Ensure this directory exists
                    size: '320x240' // Change to desired size
                });
        }
    });
}

async function getVideoMetadata(filePath) {
    return new Promise((resolve, reject) => {
        ffmpeg.ffprobe(filePath, (err, metadata) => {
            if (err) return reject(err);
            resolve(metadata);
        });
    });
}

function extractReleaseDateFromTitle(title) {
    // Regex to match the date in the format "Month Day, Year"
    const datePattern = /([A-Za-z]+\s\d{1,2},\s\d{4})/;
    const match = title.match(datePattern);
    if (match) {
        const dateStr = match[0];
        // Format the date in YYYY-MM-DD for releaseDate
        const dateObj = new Date(dateStr);
        console.log("dateObj: " + dateObj.toISOString().split('T')[0]);
        return dateObj.toISOString().split('T')[0]; // Return YYYY-MM-DD
    }
    // Default release date if not found
    return '2024-01-01';
}

// Generate the initial JSON feed
generateJsonFeed();
