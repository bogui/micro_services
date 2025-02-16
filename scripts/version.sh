#!/bin/bash

# Check if version type is provided
if [ -z "$1" ]; then
    echo "Usage: $0 <major|minor|patch>"
    exit 1
fi

# Validate version type
case "$1" in
    major|minor|patch) ;;
    *)
        echo "Invalid version type. Use major, minor, or patch"
        exit 1
        ;;
esac

# Update version
npm version "$1" --no-git-tag-version

# Get the new version
NEW_VERSION=$(node -p "require('./package.json').version")

# Create changelog entry
CHANGELOG_ENTRY="## [$NEW_VERSION] - $(date +%Y-%m-%d)\n\n### Added\n- \n\n### Changed\n- \n\n### Fixed\n- \n"

# Update CHANGELOG.md
if [ ! -f CHANGELOG.md ]; then
    echo "# Changelog\n\n$CHANGELOG_ENTRY" > CHANGELOG.md
else
    sed -i "4i $CHANGELOG_ENTRY" CHANGELOG.md
fi

# Create release branch
git checkout -b "release/v$NEW_VERSION"

# Commit changes
git add package.json package-lock.json CHANGELOG.md
git commit -m "chore(release): prepare v$NEW_VERSION"

echo "Release branch created: release/v$NEW_VERSION"
echo "Please update CHANGELOG.md with the changes and then run:"
echo "git push origin release/v$NEW_VERSION"
