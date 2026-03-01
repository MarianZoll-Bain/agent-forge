#!/usr/bin/env bash
set -euo pipefail

# AgentForge installer — downloads the latest release for your platform.
# Usage: curl -fsSL https://raw.githubusercontent.com/MarianZoll-Bain/agent-forge/main/install.sh | bash

REPO="MarianZoll-Bain/agent-forge"

info()  { printf '\033[1;34m→\033[0m %s\n' "$*"; }
ok()    { printf '\033[1;32m✓\033[0m %s\n' "$*"; }
err()   { printf '\033[1;31m✗\033[0m %s\n' "$*" >&2; exit 1; }

# Detect OS and architecture
OS="$(uname -s)"
ARCH="$(uname -m)"

case "$ARCH" in
  x86_64)  ARCH="x64" ;;
  aarch64|arm64) ARCH="arm64" ;;
  *) err "Unsupported architecture: $ARCH" ;;
esac

# Fetch latest release tag
info "Fetching latest release..."
TAG="$(curl -fsSL "https://api.github.com/repos/${REPO}/releases/latest" | grep '"tag_name"' | head -1 | sed 's/.*"tag_name": *"\([^"]*\)".*/\1/')"
[ -z "$TAG" ] && err "Could not determine latest release tag"
VERSION="${TAG#v}"
info "Latest version: $VERSION"

case "$OS" in
  Darwin)
    ARTIFACT="AgentForge-${VERSION}-${ARCH}.dmg"
    URL="https://github.com/${REPO}/releases/download/${TAG}/${ARTIFACT}"
    TMPFILE="$(mktemp /tmp/agentforge-XXXXXX.dmg)"

    info "Downloading $ARTIFACT..."
    curl -fSL -o "$TMPFILE" "$URL" || err "Download failed: $URL"

    info "Mounting DMG..."
    MOUNT_DIR="$(hdiutil attach "$TMPFILE" -nobrowse -noverify | tail -1 | awk -F'\t' '{print $NF}')"

    info "Copying AgentForge.app to /Applications..."
    cp -R "${MOUNT_DIR}/AgentForge.app" /Applications/ 2>/dev/null || \
      sudo cp -R "${MOUNT_DIR}/AgentForge.app" /Applications/

    hdiutil detach "$MOUNT_DIR" -quiet
    rm -f "$TMPFILE"

    ok "AgentForge installed to /Applications/AgentForge.app"
    info "Run: open /Applications/AgentForge.app"
    ;;

  Linux)
    if command -v dpkg >/dev/null 2>&1; then
      ARTIFACT="AgentForge-${VERSION}-amd64.deb"
      URL="https://github.com/${REPO}/releases/download/${TAG}/${ARTIFACT}"
      TMPFILE="$(mktemp /tmp/agentforge-XXXXXX.deb)"

      info "Downloading $ARTIFACT..."
      curl -fSL -o "$TMPFILE" "$URL" || err "Download failed: $URL"

      info "Installing .deb package..."
      sudo dpkg -i "$TMPFILE" || sudo apt-get install -f -y
      rm -f "$TMPFILE"

      ok "AgentForge installed via dpkg"
      info "Run: agentforge"
    else
      ARTIFACT="AgentForge-${VERSION}-x86_64.AppImage"
      URL="https://github.com/${REPO}/releases/download/${TAG}/${ARTIFACT}"
      DEST="${HOME}/.local/bin/AgentForge.AppImage"

      mkdir -p "$(dirname "$DEST")"

      info "Downloading $ARTIFACT..."
      curl -fSL -o "$DEST" "$URL" || err "Download failed: $URL"
      chmod +x "$DEST"

      ok "AgentForge installed to $DEST"
      info "Run: $DEST"
    fi
    ;;

  *)
    err "Unsupported OS: $OS. For Windows, download the .exe from https://github.com/${REPO}/releases/latest"
    ;;
esac
