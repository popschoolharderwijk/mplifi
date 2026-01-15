
```
# reset lovable branch (delete history (will confuse Lovable))
git checkout -B lovable origin/main
git push -u origin lovable --force
```
# Boilerplate

```
# Reset the entire history
git checkout main
git pull origin main

git checkout --orphan temp-main
git add -A
git commit -m "Initial commit"

git branch -D main
git branch -m main

git push --force origin main
```