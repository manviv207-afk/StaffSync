
import { useState } from "react";

const API_URL = `${(import.meta.env.VITE_API_URL || "/api").replace(/\/$/, "")}/auth`;

function Signup({ onSwitchToLogin, onSignupSuccess }) {
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
  });
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage("");
    setLoading(true);

    try {
      const response = await fetch(`${API_URL}/signup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || "Signup failed.");
      }

      setMessage("Account created successfully! You can log in now.");
      setForm({ name: "", email: "", password: "" });

      if (onSignupSuccess) onSignupSuccess();
    } catch (error) {
      setMessage(error.message || "Cannot connect to the server.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main style={styles.page}>
      <form onSubmit={handleSubmit} style={styles.card}>
        <h1 style={styles.title}>Create Account</h1>
        <p style={styles.subtitle}>Join StaffSync</p>

        <label style={styles.label}>Full Name</label>
        <input
          style={styles.input}
          name="name"
          value={form.name}
          onChange={handleChange}
          placeholder="Enter your name"
          required
        />

        <label style={styles.label}>Email Address</label>
        <input
          style={styles.input}
          type="email"
          name="email"
          value={form.email}
          onChange={handleChange}
          placeholder="Enter your email"
          required
        />

        <label style={styles.label}>Password</label>
        <input
          style={styles.input}
          type="password"
          name="password"
          value={form.password}
          onChange={handleChange}
          placeholder="At least 8 characters"
          minLength={8}
          required
        />

        <button style={styles.button} disabled={loading}>
          {loading ? "Creating account..." : "Sign Up"}
        </button>

        {message && <p role="status" style={styles.message}>{message}</p>}

        <p style={styles.footer}>
          Already have an account?{" "}
          <button type="button" style={styles.link} onClick={onSwitchToLogin}>
            Log In
          </button>
        </p>
      </form>
    </main>
  );
}

const styles = {
  page: {
    minHeight: "100vh",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    background: "#f3f5f9",
    padding: 20,
    boxSizing: "border-box",
  },
  card: {
    width: "100%",
    maxWidth: 400,
    background: "#fff",
    padding: 32,
    borderRadius: 14,
    boxShadow: "0 8px 30px rgba(0,0,0,0.08)",
    boxSizing: "border-box",
  },
  title: { margin: "0 0 8px", color: "#202b46" },
  subtitle: { marginBottom: 24, color: "#6b7280" },
  label: { display: "block", margin: "14px 0 6px", fontSize: 14 },
  input: {
    width: "100%",
    padding: 12,
    border: "1px solid #d1d5db",
    borderRadius: 7,
    boxSizing: "border-box",
  },
  button: {
    width: "100%",
    padding: 12,
    marginTop: 22,
    border: 0,
    borderRadius: 7,
    background: "#3457d5",
    color: "white",
    cursor: "pointer",
  },
  message: { fontSize: 14, overflowWrap: "anywhere" },
  footer: { marginTop: 20, fontSize: 14, textAlign: "center" },
  link: {
    border: 0,
    background: "none",
    color: "#3457d5",
    cursor: "pointer",
  },
};

export default Signup;
