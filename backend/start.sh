#!/bin/bash

# Explicitly fetch Prisma binaries
echo "Fetching Prisma binaries..."
prisma py fetch

# Generate Prisma client
echo "Generating Prisma client..."
python generate_prisma.py

# Start the application
echo "Starting the application..."
uvicorn main:app --host 0.0.0.0 --port ${PORT:-8000} --reload
