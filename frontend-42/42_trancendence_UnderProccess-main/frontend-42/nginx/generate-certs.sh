#!/bin/bash

# Create SSL directory if it doesn't exist
mkdir -p ssl

# Generate self-signed SSL certificate
openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
    -keyout ssl/key.pem \
    -out ssl/cert.pem \
    -subj "/C=US/ST=State/L=City/O=Organization/CN=localhost"

echo "✓ Self-signed SSL certificates generated successfully!"
echo "  - Certificate: ssl/cert.pem"
echo "  - Private Key: ssl/key.pem"
echo ""
echo "Note: Your browser will show a security warning because this is a self-signed certificate."
echo "You'll need to accept the warning to proceed."
