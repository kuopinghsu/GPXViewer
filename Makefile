SHELL := /bin/bash

.PHONY: help build clean rebuild check

help:
	@echo "Available targets:"
	@echo "  make build   - Generate single-file app (index.html and dist/index.html)"
	@echo "  make clean   - Remove generated output files"
	@echo "  make rebuild - Clean and build"
	@echo "  make check   - Build and confirm output files exist"

build:
	node build.js

clean:
	rm -f index.html dist/index.html

rebuild: clean build

check: build
	@test -f index.html
	@test -f dist/index.html
	@echo "Check passed: index.html and dist/index.html are present."
