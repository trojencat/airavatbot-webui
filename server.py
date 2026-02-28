import http.server
import socketserver
import os
import sys

PORT = int(os.environ.get('PORT', 4173))
DIST = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'dist')

class SPAHTTPRequestHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=DIST, **kwargs)

    def do_GET(self):
        # Determine the path being requested
        path = self.translate_path(self.path)
        
        # If the path corresponds to an existing file, let SimpleHTTPRequestHandler handle it natively
        if os.path.isfile(path):
            return super().do_GET()
            
        # If it's not a file (e.g., a routing path like /settings), serve index.html for SPA
        index_path = os.path.join(DIST, 'index.html')
        if os.path.isfile(index_path):
            self.send_response(200)
            self.send_header("Content-type", "text/html")
            self.end_headers()
            with open(index_path, 'rb') as file:
                self.wfile.write(file.read())
        else:
            self.send_error(404, "File not found and index.html missing")

if __name__ == "__main__":
    if not os.path.isdir(DIST):
        print(f"Warning: The distribution directory '{DIST}' does not exist.")
        
    with socketserver.TCPServer(("", PORT), SPAHTTPRequestHandler) as httpd:
        print(f"\n⚡ Airavat WebUI serving on http://localhost:{PORT}\n")
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\n🛑 Shutting down WebUI...")
            httpd.server_close()
            sys.exit(0)
