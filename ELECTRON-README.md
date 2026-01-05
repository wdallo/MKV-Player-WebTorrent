# MKV Video Player - Electron Desktop App

This MKV Video Player has been configured to run as an Electron desktop application using Electron Forge.

## Quick Start

### Development Mode

```bash
npm run electron-dev
```

Or on Windows, double-click: `start-electron-dev.bat`

### Production Build

```bash
npm run electron
```

### Package for Distribution

```bash
npm run build
```

## Available Scripts

- `npm run electron` - Run the app in production mode
- `npm run electron-dev` - Run the app in development mode (with DevTools)
- `npm run electron-pack` - Package the app without creating distributables
- `npm run build` - Create platform-specific distributables
- `npm run start` - Run just the web server (original mode)

## Build Outputs

When you run `npm run build`, Electron Forge will create:

- **Windows**: `.exe` installer (Squirrel)
- **macOS**: `.dmg` disk image
- **Linux**: `.deb` and `.rpm` packages

Files will be created in the `out/` directory.

## Project Structure

- `electron-main.js` - Main Electron process
- `preload.js` - Preload script for secure renderer communication
- `app.js` - Express server (unchanged)
- `package.json` - Updated with Electron Forge configuration

## How It Works

1. Electron starts the main process (`electron-main.js`)
2. Main process spawns the Express server (`app.js`)
3. Electron opens a browser window pointing to `http://localhost:3000`
4. Your web app runs inside the Electron window

## Customization

### App Icon

Place your icon files in the project root:

- `icon.png` (256x256) for Windows/Linux
- `icon.icns` for macOS

### Window Settings

Edit `electron-main.js` to customize:

- Window size and behavior
- Security settings
- Menu structure

### Build Configuration

Edit `package.json` under `config.forge` to customize:

- Package settings
- Build targets
- Output formats

## Security Features

- Context isolation enabled
- Node.js integration disabled
- Secure preload script
- External link protection
- Navigation restrictions

## Troubleshooting

### "Unknown Software Exception" Error

If you get an "unknown software exception" error when running the built version:

1. **Check console logs**: Look for error messages in the terminal where you ran the app
2. **Try development mode first**: Run `npm run electron-dev` to see detailed error messages
3. **Verify dependencies**: Make sure all dependencies are installed with `npm install`
4. **Check paths**: The app tries to start a server - path issues can cause crashes

### Common Issues

1. **Port conflicts**:
   - Change PORT in both `electron-main.js` and `app.js` if port 3000 is in use
   - Error: "EADDRINUSE: address already in use"

2. **Build errors**:
   - Ensure all dependencies are installed: `npm install`
   - Delete `node_modules` and reinstall if needed: `rm -rf node_modules && npm install`

3. **Icon issues**:
   - Check icon file format and location
   - Icon files should be in the project root

4. **Performance**:
   - Close DevTools in production builds
   - Check if antivirus is interfering with the executable

### Debug Mode

For debugging packaged builds, check the console output for:

- "App is packaged: true/false"
- Server path and CWD information
- Any server startup errors

### Getting Help

If problems persist:

1. Run `npm run electron-dev` and check the DevTools console
2. Check the terminal output for server errors
3. Verify all project files are present in the `out/` build directory

## Development Tips

- Use `npm run electron-dev` for development with DevTools
- Server logs appear in the terminal
- Renderer logs appear in DevTools console
- Hot reload is not enabled - restart Electron after changes
