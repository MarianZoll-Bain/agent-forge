# Agent Orchestrator – local run and test
# Usage: make install && make dev   (first time)
#        make dev                    (start app)
#        make test                   (run tests)

.PHONY: install dev run test build check pack dist dist-mac dist-win dist-linux clean

# Install dependencies
install:
	npm install

# Start the app locally with hot reload (renderer HMR + main/preload watch).
# Main process logs go to this terminal; use DEBUG=1 for verbose IPC logs.
dev:
	npm run dev

# Same as dev but with verbose main-process logs (IPC args, steps).
dev-verbose:
	DEBUG=1 npm run dev

# Alias for dev
run: dev

# Run unit tests (Vitest)
test:
	npm run test

# Run tests in watch mode
test-watch:
	npm run test:watch

# Production build (output in out/)
build:
	npm run build

# Test the system: run tests then build (fails if either fails)
check: test build

# Package app without creating installer (for testing)
pack:
	npm run pack

# Build distributable for current platform
dist:
	npm run dist

# Build distributable for macOS (dmg + zip, x64 + arm64)
dist-mac:
	npm run dist:mac

# Build distributable for Windows (NSIS installer, x64)
dist-win:
	npm run dist:win

# Build distributable for Linux (AppImage + deb, x64)
dist-linux:
	npm run dist:linux

# Remove build output (optional)
clean:
	rm -rf out release dist
