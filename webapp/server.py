#!/usr/bin/env python3
"""
Simple proxy server to handle CORS for Ciphex API requests.
Serves static files and proxies /api/* requests to api.ciphex.io
"""

import http.server
import socketserver
import urllib.request
import urllib.error
import json
import os
from urllib.parse import urlparse, parse_qs

PORT = 8080
CIPHEX_API_URL = "https://api.ciphex.io"

class ProxyHandler(http.server.SimpleHTTPRequestHandler):
    def do_OPTIONS(self):
        """Handle CORS preflight requests."""
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type, X-API-Key')
        self.end_headers()

    def do_GET(self):
        # Proxy requests to /api/* to Ciphex
        if self.path.startswith('/api/'):
            self.proxy_request()
        else:
            # Serve static files
            super().do_GET()

    def proxy_request(self):
        """Proxy request to Ciphex API."""
        # Remove /api prefix and forward to Ciphex
        target_path = self.path[4:]  # Remove '/api'
        target_url = f"{CIPHEX_API_URL}{target_path}"

        # Get API key from request header
        api_key = self.headers.get('X-API-Key', '')

        try:
            # Create request to Ciphex
            req = urllib.request.Request(target_url)
            req.add_header('Content-Type', 'application/json')
            req.add_header('X-API-Key', api_key)

            # Make request
            with urllib.request.urlopen(req, timeout=30) as response:
                data = response.read()

                # Send response with CORS headers
                self.send_response(200)
                self.send_header('Content-Type', 'application/json')
                self.send_header('Access-Control-Allow-Origin', '*')
                self.send_header('Access-Control-Allow-Headers', 'Content-Type, X-API-Key')
                self.end_headers()
                self.wfile.write(data)

        except urllib.error.HTTPError as e:
            self.send_response(e.code)
            self.send_header('Content-Type', 'application/json')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            error_body = e.read().decode('utf-8') if e.fp else '{}'
            self.wfile.write(error_body.encode())

        except Exception as e:
            self.send_response(500)
            self.send_header('Content-Type', 'application/json')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            self.wfile.write(json.dumps({'error': str(e)}).encode())

    def log_message(self, format, *args):
        """Custom log format."""
        print(f"[{self.log_date_time_string()}] {args[0]}")


def main():
    os.chdir(os.path.dirname(os.path.abspath(__file__)))

    with socketserver.TCPServer(("", PORT), ProxyHandler) as httpd:
        print(f"=" * 50)
        print(f"Ciphex Predictions POC Server")
        print(f"=" * 50)
        print(f"Server running at: http://localhost:{PORT}")
        print(f"Proxying /api/* to: {CIPHEX_API_URL}")
        print(f"Press Ctrl+C to stop")
        print(f"=" * 50)

        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\nShutting down...")


if __name__ == "__main__":
    main()
