#!/usr/bin/env bash
# exit on error
set -o errexit

npm install

# Install Chrome to a specific path that we will also tell the bot to look in
npx puppeteer browsers install chrome --path /opt/render/project/src/.cache/puppeteer