#!/usr/bin/env bash
# exit on error
set -o errexit

npm install

# Install chrome using the local configuration
npx puppeteer browsers install chrome