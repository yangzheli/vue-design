#!/usr/bin/env sh

set -e

npm run docs:build

cd docs/.vuepress/dist

echo 'yangzheli.com' > CNAME

git init
git config user.name 'yangzheli'
git config user.email '1936558266@qq.com'
git add -A
git commit -m 'deploy'

git push -f git@github.com:yangzheli/vue-design.git master:gh-pages

cd -