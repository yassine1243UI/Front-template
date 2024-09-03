const multer = require('multer');
const path = require('path');
const fs = require('fs');
const db = require('../config/db');

// Configure Multer storage for file uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const userDir = './uploads/' + req.user.user_id;

        // Create user-specific directory if it doesn't exist
        if (!fs.existsSync(userDir)) {
            fs.mkdirSync(userDir, { recursive: true });
        }

        cb(null, userDir); // Save files to the user's directory
    },
    filename: (req, file, cb) => {
        // Save file with timestamp to avoid naming conflicts
        cb(null, Date.now() + path.extname(file.originalname));
    }
});

// Configure Multer upload with size limit (50MB)
const upload = multer({
    storage: storage,
    limits: { fileSize: 50 * 1024 * 1024 } // 50 MB file size limit
}).single('file'); // Expecting a single file with the form field name 'file'

// File upload handler
exports.uploadFile = (req, res) => {
    // Perform the file upload
    upload(req, res, function (err) {
        if (err instanceof multer.MulterError) {
            // Handle Multer-specific errors
            console.log("Multer error: ", err);
            return res.status(500).json({ message: `Multer error: ${err.message}` });
        } else if (err) {
            // Handle general errors (e.g., file system errors)
            console.log("General error: ", err);
            return res.status(500).json({ message: `Error uploading file: ${err.message}` });
        }

        // If no file is provided
        if (!req.file) {
            return res.status(400).json({ message: 'No file provided' });
        }

        // File upload was successful, now save file metadata to the database
        const file = req.file;
        console.log("Uploaded file details: ", file);  // Log file details for debugging

        const sql = 'INSERT INTO files (user_id, file_name, file_size, file_type, path) VALUES (?, ?, ?, ?, ?)';
        db.query(sql, [req.user.user_id, file.filename, file.size, file.mimetype, file.path], (err, result) => {
            if (err) {
                console.log("Database error: ", err);  // Log the database error for debugging
                return res.status(500).json({ message: 'Error saving file info' });
            }
        
            res.status(201).json({ message: 'File uploaded successfully', file: file });
        });
        
    });
};


exports.getUserFiles = (req, res) => {
    const sql = 'SELECT * FROM files WHERE user_id = ? AND is_deleted = 0';
    db.query(sql, [req.user.user_id], (err, result) => {
        if (err) {
            console.log("Database error: ", err);
            return res.status(500).json({ message: 'Error fetching files' });
        }
        res.status(200).json(result);  // Return the list of files
    });
};


exports.renameFile = (req, res) => {
    const { newFileName } = req.body;
    const fileId = req.params.id;

    const sql = 'UPDATE files SET file_name = ? WHERE file_id = ? AND user_id = ?';
    db.query(sql, [newFileName, fileId, req.user.user_id], (err, result) => {
        if (err) {
            console.log("Database error: ", err);
            return res.status(500).json({ message: 'Error renaming file' });
        }
        res.status(200).json({ message: 'File renamed successfully' });
    });
};


exports.deleteFile = (req, res) => {
    const fileId = req.params.id;

    const sql = 'UPDATE files SET is_deleted = 1 WHERE file_id = ? AND user_id = ?';
    db.query(sql, [fileId, req.user.user_id], (err, result) => {
        if (err) {
            console.log("Database error: ", err);
            return res.status(500).json({ message: 'Error deleting file' });
        }
        res.status(200).json({ message: 'File deleted successfully' });
    });
};




exports.downloadFile = (req, res) => {
    const fileId = req.params.id;

    const sql = 'SELECT * FROM files WHERE file_id = ? AND user_id = ? AND is_deleted = 0';
    db.query(sql, [fileId, req.user.user_id], (err, result) => {
        if (err || result.length === 0) {
            return res.status(404).json({ message: 'File not found' });
        }

        const file = result[0];
        const filePath = path.join(__dirname, '..', file.path);
        res.download(filePath);  // This will trigger the file download
    });
};
