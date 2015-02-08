#!/bin/sh

# export NODE_ENV=production
# updateCampaignFinished.js
export NODE_ENV=production

cd "/opt/www/shopbyblog.com"
# /usr/local/bin/node /Users/chriswitko/shopbyblog/cron/scripts/$1
/usr/local/bin/node /usr/local/bin/s3-upload