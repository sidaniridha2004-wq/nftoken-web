import Link from "next/link";

export default function NotFound() {
  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", background: "#0a0b0e", color: "#fff", fontFamily: "sans-serif" }}>
      <h1 style={{ fontSize: "2rem", marginBottom: "0.5rem" }}>404 - Page Not Found</h1>
      <p style={{ color: "#8a90a2", marginBottom: "1.5rem" }}>The requested page could not be found.</p>
      <Link href="/" style={{ color: "#e50914", textDecoration: "underline" }}>
        Return to Home
      </Link>
    </div>
  );
}
