/** @type {import('next').NextConfig} */
const nextConfig = {
  async rewrites() {
    return [
      {
        source: "/photos/:path*",
        destination: "http://127.0.0.1:8000/photos/:path*",
      },
    ];
  },
};

export default nextConfig;
