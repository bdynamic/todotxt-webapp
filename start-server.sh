#!/bin/bash

echo "====================================="
echo "Todo.txt Webapp - Server Startup"
echo "====================================="
echo ""

# Check for npm dependencies
if [ ! -d "node_modules" ]; then
    echo "Installing dependencies..."
    npm install
    echo ""
fi

# Set environment variables for verbose logging
export DEBUG=true

# Parse command line arguments
ARGS="$@"
if [[ ! "$ARGS" =~ "--verbose" ]]; then
    ARGS="$ARGS --verbose"
fi

echo "Configuration:"
echo "  Data Directory: ${TODO_DATA_DIR:-/tmp/tododata}"
echo "  Config Directory: ${TODO_CONFIG_DIR:-~/.config/todotxt-git}"
echo "  Debug Mode: ${DEBUG:-true}"
echo ""

echo "Starting server with verbose logging..."
echo "====================================="
echo ""

node node-server.js $ARGS
