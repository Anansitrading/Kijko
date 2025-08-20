#!/bin/bash

# Kijko GitHub Repository Creation Script
# This script helps you create and push the Kijko project to GitHub

echo "🎬 Kijko - GitHub Repository Setup"
echo "=================================="
echo ""

# Check if we're in the right directory
if [ ! -f "package.json" ] || [ ! -d "frontend" ] || [ ! -d "backend" ]; then
    echo "❌ Error: Please run this script from the Kijko project root directory"
    exit 1
fi

echo "📋 Step 1: Create GitHub Repository"
echo "Please follow these steps to create your GitHub repository:"
echo ""
echo "1. Go to https://github.com/new"
echo "2. Repository name: Kijko"
echo "3. Description: 🎬 AI-Powered Video Production Platform with Google Gemini Integration"
echo "4. Set to Public"
echo "5. Do NOT initialize with README, .gitignore, or license (we already have these)"
echo "6. Click 'Create repository'"
echo ""

read -p "Press Enter when you've created the repository on GitHub..."

echo ""
echo "📋 Step 2: Enter Repository Information"
read -p "Enter your GitHub username: " github_username
echo ""

# Set the repository URL
repo_url="https://github.com/${github_username}/Kijko.git"

echo "🔗 Repository URL: $repo_url"
echo ""

# Add remote origin
echo "📡 Adding remote origin..."
if git remote get-url origin >/dev/null 2>&1; then
    echo "⚠️  Remote origin already exists. Removing..."
    git remote remove origin
fi

git remote add origin "$repo_url"

# Rename branch to main
echo "🌿 Setting up main branch..."
git branch -M main

# Push to GitHub
echo "🚀 Pushing to GitHub..."
if git push -u origin main; then
    echo ""
    echo "✅ Success! Your Kijko project has been pushed to GitHub!"
    echo ""
    echo "🔗 Your repository is now available at:"
    echo "   https://github.com/${github_username}/Kijko"
    echo ""
    echo "📋 Next steps:"
    echo "1. Add your Gemini API key to the .env file"
    echo "2. Run 'npm install' in both backend/ and frontend/ directories"
    echo "3. Start the development servers"
    echo "4. Begin creating amazing AI-powered videos!"
    echo ""
    echo "🎬 Happy video creating with Kijko! 🎬"
else
    echo ""
    echo "❌ Error: Failed to push to GitHub"
    echo "This might be due to authentication issues."
    echo ""
    echo "💡 Solutions:"
    echo "1. Make sure you're logged into GitHub"
    echo "2. Check if you have push permissions to the repository"
    echo "3. Try using SSH instead: git remote set-url origin git@github.com:${github_username}/Kijko.git"
    echo "4. Or try the GitHub CLI: gh repo create Kijko --public --push"
    echo ""
    echo "Manual push command:"
    echo "git push -u origin main"
fi