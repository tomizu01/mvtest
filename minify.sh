#!/bin/bash

# Minification Script for mukuviewer
# This script compresses JavaScript and CSS files

echo "====================================="
echo "  mukuviewer - File Minification"
echo "====================================="

# Check if terser is installed
if ! command -v npx &> /dev/null || ! npx terser --version &> /dev/null 2>&1; then
    echo "Error: terser is not installed"
    echo "Installing terser..."
    npm install --save-dev terser
fi

# Check if clean-css-cli is installed
if ! npx cleancss --version &> /dev/null 2>&1; then
    echo "Error: clean-css-cli is not installed"
    echo "Installing clean-css-cli..."
    npm install --save-dev clean-css-cli
fi

echo ""
echo "Minifying JavaScript files..."
echo "-------------------------------------"

# Minify main.js
npx terser js/main.js -o js/main.min.js -c -m --comments false

# Show JS file sizes
JS_ORIGINAL=$(stat -c%s js/main.js 2>/dev/null || stat -f%z js/main.js)
JS_MINIFIED=$(stat -c%s js/main.min.js 2>/dev/null || stat -f%z js/main.min.js)
JS_REDUCTION=$(echo "scale=1; 100 - ($JS_MINIFIED * 100 / $JS_ORIGINAL)" | bc)

echo "  js/main.js     : $(ls -lh js/main.js | awk '{print $5}')"
echo "  js/main.min.js : $(ls -lh js/main.min.js | awk '{print $5}') (${JS_REDUCTION}% reduction)"

echo ""
echo "Minifying CSS files..."
echo "-------------------------------------"

# Minify styles.css
npx cleancss -o css/styles.min.css css/styles.css

# Show CSS file sizes
CSS_ORIGINAL=$(stat -c%s css/styles.css 2>/dev/null || stat -f%z css/styles.css)
CSS_MINIFIED=$(stat -c%s css/styles.min.css 2>/dev/null || stat -f%z css/styles.min.css)
CSS_REDUCTION=$(echo "scale=1; 100 - ($CSS_MINIFIED * 100 / $CSS_ORIGINAL)" | bc)

echo "  css/styles.css     : $(ls -lh css/styles.css | awk '{print $5}')"
echo "  css/styles.min.css : $(ls -lh css/styles.min.css | awk '{print $5}') (${CSS_REDUCTION}% reduction)"

echo ""
echo "====================================="
echo "  Minification Complete!"
echo "====================================="
echo ""
echo "Total savings:"
TOTAL_ORIGINAL=$((JS_ORIGINAL + CSS_ORIGINAL))
TOTAL_MINIFIED=$((JS_MINIFIED + CSS_MINIFIED))
TOTAL_SAVED=$((TOTAL_ORIGINAL - TOTAL_MINIFIED))
TOTAL_REDUCTION=$(echo "scale=1; 100 - ($TOTAL_MINIFIED * 100 / $TOTAL_ORIGINAL)" | bc)

echo "  Original : $(numfmt --to=iec --suffix=B $TOTAL_ORIGINAL 2>/dev/null || echo "$((TOTAL_ORIGINAL/1024))KB")"
echo "  Minified : $(numfmt --to=iec --suffix=B $TOTAL_MINIFIED 2>/dev/null || echo "$((TOTAL_MINIFIED/1024))KB")"
echo "  Saved    : $(numfmt --to=iec --suffix=B $TOTAL_SAVED 2>/dev/null || echo "$((TOTAL_SAVED/1024))KB") (${TOTAL_REDUCTION}% reduction)"
echo ""
