# Promptadigm Application Icons

## Icon Files

- `icon.svg` - Source SVG icon (256x256)
- `icon.png` - PNG version for Windows/Linux (should be 256x256)
- `icon.icns` - macOS icon format (for future macOS builds)
- `icon.ico` - Windows ICO format (for future Windows builds)

## Converting SVG to PNG

To convert the SVG to PNG format, you can use:

1. **Online converters**: Upload icon.svg to any SVG to PNG converter
2. **Command line with ImageMagick**: `magick convert icon.svg -resize 256x256 icon.png`
3. **Inkscape**: `inkscape icon.svg --export-type=png --export-filename=icon.png --export-width=256 --export-height=256`

## Icon Sizes Needed

- **256x256 PNG** - Main application icon
- **128x128 PNG** - Medium size icon
- **64x64 PNG** - Small size icon
- **32x32 PNG** - Taskbar icon
- **16x16 PNG** - Small taskbar/title bar icon

For production builds, you may want to create multiple sizes and use tools like `electron-icon-builder` to generate all required formats.