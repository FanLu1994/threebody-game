"""本地静态服务器（no-cache），默认绑定 0.0.0.0 允许局域网访问
用法: python server.py [端口]   （默认 8641）
"""
import http.server, socketserver, os, sys, socket

class NoCache(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-cache, no-store, must-revalidate")
        self.send_header("Pragma", "no-cache")
        self.send_header("Expires", "0")
        super().end_headers()

def lan_ips():
    """枚举本机局域网 IPv4 地址（不实际发包）"""
    ips = set()
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.settimeout(0)
        s.connect(("8.8.8.8", 80))
        ips.add(s.getsockname()[0])
        s.close()
    except Exception:
        pass
    try:
        for info in socket.getaddrinfo(socket.gethostname(), None, socket.AF_INET):
            ip = info[4][0]
            if not ip.startswith("127."):
                ips.add(ip)
    except Exception:
        pass
    return sorted(ips)

if __name__ == "__main__":
    os.chdir(os.path.join(os.path.dirname(os.path.abspath(__file__))))
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8641
    socketserver.ThreadingTCPServer.allow_reuse_address = True
    with socketserver.ThreadingTCPServer(("0.0.0.0", port), NoCache) as httpd:
        print(f"serving game at http://localhost:{port}/ (no-cache, LAN allowed)")
        for ip in lan_ips():
            print(f"  局域网访问: http://{ip}:{port}/")
        httpd.serve_forever()
