#!/usr/bin/env bash

set -euo pipefail

# Installs all testing-related dev dependencies in one go.
# Re-run whenever the test harness expands (e.g., adding new tooling).

pnpm add -D \
  vitest \
  @testing-library/react \
  @testing-library/jest-dom \
  @testing-library/user-event \
  happy-dom \
  msw \
  msw-storybook-addon \
  supertest \
  fast-check \
  @vitest/coverage-v8 \
  playwright \
  @playwright/test \
  ts-node
