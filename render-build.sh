#!/usr/bin/env bash
# exit on error
set -o errexit

npm install

# This command downloads and installs the necessary Chrome dependencies for Puppeteer
# It creates a local cache so the browser is available to the bot
npx puppeteer browsers install chrome