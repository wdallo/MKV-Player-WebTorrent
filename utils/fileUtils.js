/**
 * File system utilities for safe file operations
 */

import fs from "fs";
import { promises as fsPromises } from "fs";
import path from "path";
import { createLogger } from "./logger.js";

const logger = createLogger("FILE_UTILS");

/**
 * Ensure directory exists, create if not
 */
export async function ensureDirectory(dirPath) {
  try {
    await fsPromises.access(dirPath);
    return true;
  } catch (error) {
    if (error.code === "ENOENT") {
      try {
        await fsPromises.mkdir(dirPath, { recursive: true });
        logger.info("Created directory", { path: dirPath });
        return true;
      } catch (mkdirError) {
        logger.error("Failed to create directory", mkdirError);
        return false;
      }
    }
    logger.error("Directory access error", error);
    return false;
  }
}

/**
 * Safely delete a file
 */
export async function safeDeleteFile(filePath) {
  try {
    // Check if path exists first
    try {
      await fsPromises.access(filePath);
    } catch (error) {
      if (error.code === "ENOENT") {
        logger.debug("File does not exist, skipping deletion", {
          path: filePath,
        });
        return true; // File doesn't exist, consider it already deleted
      }
      throw error; // Re-throw if it's not a "not found" error
    }

    // Check if it's a file or directory
    const stats = await fsPromises.stat(filePath);

    if (stats.isDirectory()) {
      logger.warn(
        "Path is a directory, not a file - use safeDeleteDirectory instead",
        { path: filePath },
      );
      // Don't delete directories with unlink - skip it
      return false;
    }

    // Delete the file
    await fsPromises.unlink(filePath);
    logger.info("File deleted successfully", { path: filePath });
    return true;
  } catch (error) {
    if (error.code === "ENOENT") {
      logger.debug("File does not exist", { path: filePath });
      return true; // Already deleted or never existed
    }

    if (error.code === "EPERM" || error.code === "EISDIR") {
      logger.error("Cannot delete: path is a directory or permission denied", {
        path: filePath,
        code: error.code,
      });
      return false;
    }

    logger.error("Failed to delete file", {
      path: filePath,
      error: error.message,
      code: error.code,
    });
    return false;
  }
}

/**
 * Safely delete a directory and its contents
 */
export async function safeDeleteDirectory(dirPath) {
  try {
    // Check if path exists first
    try {
      await fsPromises.access(dirPath);
    } catch (error) {
      if (error.code === "ENOENT") {
        logger.debug("Directory does not exist, skipping deletion", {
          path: dirPath,
        });
        return true; // Directory doesn't exist, consider it already deleted
      }
      throw error; // Re-throw if it's not a "not found" error
    }

    // Check if it's actually a directory
    const stats = await fsPromises.stat(dirPath);

    if (!stats.isDirectory()) {
      logger.warn("Path is not a directory - use safeDeleteFile instead", {
        path: dirPath,
      });
      return false;
    }

    // Delete the directory recursively
    await fsPromises.rm(dirPath, { recursive: true, force: true });
    logger.info("Directory deleted successfully", { path: dirPath });
    return true;
  } catch (error) {
    if (error.code === "ENOENT") {
      logger.debug("Directory does not exist", { path: dirPath });
      return true; // Already deleted or never existed
    }

    logger.error("Failed to delete directory", {
      path: dirPath,
      error: error.message,
      code: error.code,
    });
    return false;
  }
}

/**
 * Get file size safely
 */
export async function getFileSize(filePath) {
  try {
    const stats = await fsPromises.stat(filePath);
    return stats.size;
  } catch (error) {
    logger.error("Failed to get file size", error);
    return 0;
  }
}

/**
 * Check if file exists
 */
export async function fileExists(filePath) {
  try {
    await fsPromises.access(filePath);
    return true;
  } catch {
    return false;
  }
}

/**
 * Get directory size recursively
 */
export async function getDirectorySize(dirPath) {
  let totalSize = 0;

  try {
    const files = await fsPromises.readdir(dirPath, { withFileTypes: true });

    for (const file of files) {
      const filePath = path.join(dirPath, file.name);

      if (file.isDirectory()) {
        totalSize += await getDirectorySize(filePath);
      } else {
        const stats = await fsPromises.stat(filePath);
        totalSize += stats.size;
      }
    }
  } catch (error) {
    logger.error("Failed to calculate directory size", error);
  }

  return totalSize;
}

/**
 * Clean old files from directory
 */
export async function cleanOldFiles(dirPath, maxAgeMs) {
  try {
    const files = await fsPromises.readdir(dirPath, { withFileTypes: true });
    const now = Date.now();
    let deletedCount = 0;

    for (const file of files) {
      if (file.isFile()) {
        const filePath = path.join(dirPath, file.name);
        const stats = await fsPromises.stat(filePath);
        const age = now - stats.mtimeMs;

        if (age > maxAgeMs) {
          await safeDeleteFile(filePath);
          deletedCount++;
        }
      }
    }

    if (deletedCount > 0) {
      logger.info("Cleaned old files", {
        count: deletedCount,
        directory: dirPath,
      });
    }

    return deletedCount;
  } catch (error) {
    logger.error("Failed to clean old files", error);
    return 0;
  }
}

/**
 * Get safe file path within allowed directory
 */
export function getSafeFilePath(baseDir, fileName) {
  const normalizedBase = path.normalize(baseDir);
  const filePath = path.join(normalizedBase, fileName);
  const normalizedPath = path.normalize(filePath);

  // Ensure the resulting path is within the base directory
  if (!normalizedPath.startsWith(normalizedBase)) {
    logger.warn("Attempted directory traversal", { fileName, baseDir });
    throw new Error("Invalid file path");
  }

  return normalizedPath;
}

/**
 * Get file extension safely
 */
export function getFileExtension(fileName) {
  if (!fileName || typeof fileName !== "string") {
    return "";
  }

  const ext = path.extname(fileName).toLowerCase();
  return ext;
}

/**
 * Check if file is a video file
 */
export function isVideoFile(fileName) {
  const videoExtensions = [
    ".mp4",
    ".mkv",
    ".avi",
    ".mov",
    ".wmv",
    ".flv",
    ".webm",
    ".m4v",
    ".mpg",
    ".mpeg",
  ];
  const ext = getFileExtension(fileName);
  return videoExtensions.includes(ext);
}

/**
 * Check if file is an audio file
 */
export function isAudioFile(fileName) {
  const audioExtensions = [
    ".mp3",
    ".wav",
    ".flac",
    ".aac",
    ".ogg",
    ".m4a",
    ".wma",
    ".opus",
  ];
  const ext = getFileExtension(fileName);
  return audioExtensions.includes(ext);
}

/**
 * Check if file is a subtitle file
 */
export function isSubtitleFile(fileName) {
  const subtitleExtensions = [".srt", ".ass", ".ssa", ".vtt", ".sub"];
  const ext = getFileExtension(fileName);
  return subtitleExtensions.includes(ext);
}
