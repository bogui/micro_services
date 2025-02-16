#!/bin/bash

# Colors for better readability
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print colored messages
print_message() {
    echo -e "${BLUE}==>${NC} $1"
}

print_success() {
    echo -e "${GREEN}==>${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}==>${NC} $1"
}

print_error() {
    echo -e "${RED}==>${NC} $1"
}

# Function to check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Check required tools
check_requirements() {
    print_message "Checking requirements..."
    
    local requirements=(git node npm)
    local missing=()
    
    for cmd in "${requirements[@]}"; do
        if ! command_exists "$cmd"; then
            missing+=("$cmd")
        fi
    done
    
    if [ ${#missing[@]} -ne 0 ]; then
        print_error "Missing required tools: ${missing[*]}"
        print_message "Please install them and run this script again"
        exit 1
    fi
    
    print_success "All requirements satisfied!"
}

# Initialize Git repository
init_repository() {
    print_message "Initializing Git repository..."
    
    # Get repository name
    read -p "Enter repository name (default: micro_services): " repo_name
    repo_name=${repo_name:-micro_services}
    
    # Get Git user information if not set
    if [ -z "$(git config --global user.name)" ]; then
        read -p "Enter your Git username: " git_username
        git config --global user.name "$git_username"
    fi
    
    if [ -z "$(git config --global user.email)" ]; then
        read -p "Enter your Git email: " git_email
        git config --global user.email "$git_email"
    fi
    
    # Initialize repository
    git init
    
    print_success "Git repository initialized!"
}

# Install dependencies
install_dependencies() {
    print_message "Installing dependencies..."
    
    # Install dependencies
    npm install
    
    print_success "Dependencies installed!"
}

# Setup Git flow
setup_gitflow() {
    print_message "Setting up Git flow..."
    
    # Create main branches
    git checkout -b main
    git checkout -b develop
    
    # Create initial commit
    touch README.md
    echo "# $repo_name" > README.md
    echo "" >> README.md
    echo "Microservices project for PDF generation and processing." >> README.md
    
    git add README.md
    git commit -m "chore: Initial commit"
    
    # Push to main and develop
    print_warning "Do you want to push to a remote repository?"
    read -p "Enter remote repository URL (leave empty to skip): " remote_url
    
    if [ ! -z "$remote_url" ]; then
        git remote add origin "$remote_url"
        git push -u origin main
        git push -u origin develop
        print_success "Pushed to remote repository!"
    else
        print_message "Skipping remote repository setup"
    fi
}

# Create Git hooks
setup_hooks() {
    print_message "Setting up Git hooks..."
    
    # Create hooks directory if it doesn't exist
    mkdir -p .git/hooks
    
    # Pre-commit hook
    cat > .git/hooks/pre-commit << 'EOF'
#!/bin/bash

# Run tests
echo "Running tests..."
npm test

# Check the exit code
if [ $? -ne 0 ]; then
    echo "Tests must pass before commit!"
    exit 1
fi

# Run linter
echo "Running linter..."
npm run lint

# Check the exit code
if [ $? -ne 0 ]; then
    echo "Linting must pass before commit!"
    exit 1
fi
EOF
    
    chmod +x .git/hooks/pre-commit
    
    # Commit message hook
    cat > .git/hooks/commit-msg << 'EOF'
#!/bin/bash

# Regular expression for conventional commits
commit_regex='^(feat|fix|docs|style|refactor|test|chore)(\([a-z-]+\))?: .+'
error_msg="Commit message format must match regex: $commit_regex"

if ! grep -qE "$commit_regex" "$1"; then
    echo "$error_msg" >&2
    exit 1
fi
EOF
    
    chmod +x .git/hooks/commit-msg
    
    print_success "Git hooks installed!"
}

# Create version bump script
create_version_script() {
    print_message "Creating version management script..."
    
    mkdir -p scripts
    
    cat > scripts/version.sh << 'EOF'
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
EOF
    
    chmod +x scripts/version.sh
    
    print_success "Version management script created!"
}

# Main execution
main() {
    print_message "Starting Git setup for microservices project..."
    
    check_requirements
    init_repository
    install_dependencies
    setup_gitflow
    setup_hooks
    create_version_script
    
    print_success "Git setup completed successfully!"
    print_message "Next steps:"
    echo "1. Review and update README.md"
    echo "2. Create feature branches with: git checkout -b feature/your-feature develop"
    echo "3. Use conventional commits: type(scope): message"
    echo "4. Create releases with: ./scripts/version.sh <major|minor|patch>"
    echo "5. Review and merge pull requests into develop"
    echo "6. Merge develop into main for production releases"
}

# Run main function
main 