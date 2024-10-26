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
        let themeCategories = [];

        const movies = await Promise.all(
            files.map(async (file, index) => {
                const filePath = path.join(videosDirectory, file);
                const stats = await fs.stat(filePath);
                if (!stats.isFile() || !(filePath.endsWith('.mp4') || filePath.endsWith('.mkv'))) return null;

                const metadata = await getVideoMetadata(filePath);
                const duration = Math.floor(metadata.format.duration);
                console.log(`Duration for ${filePath}: ${metadata.format.duration}`);

                // Extract the full title
                const fullTitle = path.parse(file).name.replace(/[|｜]/g, ' ').replace(/[：]/g, ':');

                // Extract theme from title: check for first instance of "  ", ":", "...", "|"
                const theme = fullTitle.split(/ {2,}|:|\.{3}|[|]/)[0].trim(); // Regex updated for double space and ellipsis

                // Extract release date from title
                const releaseDate = extractReleaseDateFromTitle(fullTitle);
                const releaseDateObj = new Date(releaseDate);

                // Generate the thumbnail and get its path
                const thumbnailPath = await generateThumbnail(filePath, fullTitle);

                return {
                    id: `video${index}`,
                    title: fullTitle,
                    shortDescription: `Manteno Church Of The Nazarene ${fullTitle}.`,
                    thumbnail: encodeURI(`${url}/output/thumbnails/${fullTitle}.jpg`), // Encode the thumbnail URL
                    releaseDate: releaseDate,
                    releaseDateObj: releaseDateObj,
                    genres: ["Religious"],
                    content: {
                        duration: duration,
                        videos: [
                            {
                                url: encodeURI(`${url}/stream/${path.basename(file)}`),
                                quality: "FHD",
                                videoType: path.extname(file).slice(1).toUpperCase(),
                            },
                        ],
                    },
                    dateAdded: new Date().toISOString(),
                };
            })
        );

        // Filter out null values
        const sortedMovies = movies.filter(Boolean);

        // Organize movies into theme categories
        sortedMovies.forEach(movie => {
            // Extract theme using the same regex
            const theme = movie.title.split(/ {2,}|:|\.{3}|[|]/)[0]?.trim();
            const existingCategory = themeCategories.find(cat => cat.themeTitle.localeCompare(theme, undefined, { sensitivity: 'accent' }) === 0);
            if (!existingCategory) {
                themeCategories.push({ themeTitle: theme, videos: [movie] });
            } else {
                existingCategory.videos.push(movie);
            }
        });

        // Build the final feed object
        const feed = {
            providerName: "Manteno Church Of The Nazarene",
            lastUpdated: new Date().toISOString(),
            language: "en",
        };

        // Add themed categories to the feed
        themeCategories.forEach(category => {
            feed[category.themeTitle] = category.videos;
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
                    size: '1280x720' // Change to desired size
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
    return '2020-01-01';
}

// Generate the initial JSON feed
generateJsonFeed();
